"""Generation speed shown in the panel: a rolling average of the last few answers, persisted
to a state file so a restart does not forget it, seeded with the board's measured typical
speed so the panel never has to say "ask it something"."""
import os
import threading

import config

_lock = threading.Lock()
_hist: list[float] = []


def _load():
    try:
        with open(config.TPS_STATE_PATH, encoding='utf-8') as fh:
            _hist[:] = [float(x) for x in fh.read().split()][-config.TPS_WINDOW:]
    except (OSError, ValueError):
        pass


def note(tps):
    with _lock:
        _hist.append(round(float(tps), 1))
        del _hist[:-config.TPS_WINDOW]
        try:
            os.makedirs(os.path.dirname(config.TPS_STATE_PATH), exist_ok=True)
            with open(config.TPS_STATE_PATH, 'w', encoding='utf-8') as fh:
                fh.write(' '.join(str(x) for x in _hist))
        except OSError as exc:
            print(f'tps state not saved: {exc}', flush=True)


def average():
    """Average of recent generations, or the measured typical speed until someone has asked."""
    return round(sum(_hist) / len(_hist), 1) if _hist else config.TPS_TYPICAL


_load()


def samples():
    return len(_hist)
