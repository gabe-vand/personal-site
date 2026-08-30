"""Reads what the board is doing right now, straight from sysfs and llama.cpp.

Why this is on the site: "runs locally" is a claim; watts and degrees are
evidence. Everything here is a handful of file reads, cached for a couple of
seconds so a page full of visitors cannot turn it into load.
"""
import glob
import json
import os
import subprocess
import threading
import time
import urllib.request

import config
import limits
import speed

_lock = threading.Lock()
_cache = {'ts': 0.0, 'data': None}
_model = {'ts': 0.0, 'data': None}
_power_mode = None
_boot_ts = time.time()


def _read(path, default=None):
    try:
        with open(path, encoding='utf-8') as fh:
            return fh.read().strip()
    except OSError:
        return default


def api_key():
    return _read(config.API_KEY_PATH, '')




def temps():
    keys = {'cpu-thermal': 'cpu', 'gpu-thermal': 'gpu', 'tj-thermal': 'junction'}
    out, socs = {}, []
    for zone in glob.glob('/sys/class/thermal/thermal_zone*'):
        kind, raw = _read(f'{zone}/type', ''), _read(f'{zone}/temp')
        if not raw or not raw.lstrip('-').isdigit():
            continue
        value = round(int(raw) / 1000, 1)
        if kind in keys:
            out[keys[kind]] = value
        elif kind.startswith('soc'):
            socs.append(value)
    if socs:
        out['soc'] = round(sum(socs) / len(socs), 1)
    return out


def power():
    """INA3221 rails in watts. VDD_IN is the whole board; the others are parts of it."""
    names = {'VDD_IN': 'total', 'VDD_CPU_GPU_CV': 'cpu_gpu', 'VDD_SOC': 'soc'}
    out = {}
    for hw in glob.glob('/sys/bus/i2c/drivers/ina3221/*/hwmon/hwmon*'):
        for n in (1, 2, 3):
            label = _read(f'{hw}/in{n}_label', '')
            mv, ma = _read(f'{hw}/in{n}_input'), _read(f'{hw}/curr{n}_input')
            if label in names and mv and ma:
                out[names[label]] = round(int(mv) * int(ma) / 1_000_000, 2)
    return out


def gpu_load():
    raw = _read('/sys/devices/platform/gpu.0/load') or _read('/sys/devices/gpu.0/load')
    return round(int(raw) / 10, 1) if raw and raw.isdigit() else None


def memory():
    info = {}
    for line in (_read('/proc/meminfo', '') or '').splitlines():
        key, _, rest = line.partition(':')
        if key in ('MemTotal', 'MemAvailable'):
            info[key] = int(rest.split()[0]) // 1024
    if 'MemTotal' not in info or 'MemAvailable' not in info:
        return None
    return {'used_mb': info['MemTotal'] - info['MemAvailable'], 'total_mb': info['MemTotal']}


def uptime_s():
    return int(float((_read('/proc/uptime', '0 0')).split()[0]))


def load1():
    return float((_read('/proc/loadavg', '0')).split()[0])


def power_mode():
    global _power_mode
    if _power_mode is None:
        try:
            out = subprocess.run(['nvpmodel', '-q'], capture_output=True, text=True, timeout=3).stdout
            _power_mode = next((ln.split(':', 1)[1].strip() for ln in out.splitlines() if 'Power Mode' in ln), 'unknown')
        except (OSError, subprocess.SubprocessError):
            _power_mode = 'unknown'
    return _power_mode


def _get(path, timeout=1.5):
    req = urllib.request.Request(config.UPSTREAM + path, headers={'Authorization': 'Bearer ' + api_key()})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read().decode('utf-8')


def llm_metrics():
    """Counters from llama.cpp's Prometheus endpoint. None when the model server is down."""
    try:
        text = _get('/metrics')
    except Exception:
        return None
    wanted = {
        'llamacpp:tokens_predicted_total': 'tokens_generated',
        'llamacpp:prompt_tokens_total': 'tokens_read',
        'llamacpp:requests_processing': 'processing',
        'llamacpp:requests_deferred': 'deferred',
    }
    out = {}
    for line in text.splitlines():
        name, _, value = line.partition(' ')
        if name in wanted:
            out[wanted[name]] = int(float(value))
    return out


def model_info():
    now = time.time()
    if _model['data'] and now - _model['ts'] < config.MODEL_INFO_CACHE_S:
        return _model['data']
    try:
        props = json.loads(_get('/props'))
        meta = (json.loads(_get('/v1/models')).get('data') or [{}])[0].get('meta') or {}
        file = os.path.basename(props.get('model_path', ''))
        data = {
            'file': file,
            'name': file.split('-Q')[0].replace('.gguf', ''),
            'quant': props.get('model_ftype'),
            'ctx': props.get('default_generation_settings', {}).get('n_ctx'),
            'slots': props.get('total_slots'),
            'params_b': round(meta['n_params'] / 1e9, 1) if meta.get('n_params') else None,
            'size_gb': round(meta['size'] / 1e9, 1) if meta.get('size') else None,
        }
        _model.update(ts=now, data=data)
    except Exception:
        pass
    return _model['data']


def snapshot():
    now = time.time()
    with _lock:
        if _cache['data'] and now - _cache['ts'] < config.TELEMETRY_CACHE_S:
            return _cache['data']
    metrics = llm_metrics()
    data = {
        'ts': int(now),
        'host': config.HOSTNAME,
        'board': config.BOARD,
        'power_mode': power_mode(),
        'temps': temps(),
        'power_w': power(),
        'gpu_load': gpu_load(),
        'mem': memory(),
        'uptime_s': uptime_s(),
        'load1': load1(),
        'online': metrics is not None,
        'busy': limits.slot_busy() or bool(metrics and metrics.get('processing')),
        'waiting': limits.waiting_count(),
        'llm': metrics,
        'model': model_info(),
        'tps_last': speed.average(),
        'tps_samples': speed.samples(),
        'api_uptime_s': int(now - _boot_ts),
    }
    with _lock:
        _cache.update(ts=now, data=data)
    return data
