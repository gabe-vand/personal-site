"""Turn src/facts.json into machine-readable metadata: JSON-LD for the page head (Person +
FAQPage, read by search and answer engines, never rendered) and site/llms.txt (a Markdown
summary for LLM crawlers). Imported by build.py. The chat model's knowledge is api/persona.py;
keep the two telling the same story."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def load() -> dict:
    return json.loads((ROOT / 'src' / 'facts.json').read_text(encoding='utf-8'))


def jsonld(f: dict) -> str:
    person = {
        '@type': 'Person', '@id': f['url'] + '#me', 'name': f['name'], 'url': f['url'], 'email': f['email'], 'telephone': f.get('phone', ''), 'jobTitle': f['title'],
        'description': f['summary'], 'sameAs': [f['linkedin']], 'knowsAbout': f['skills'],
        'address': {'@type': 'PostalAddress', 'addressLocality': f['location']['locality'], 'addressRegion': f['location']['region'], 'addressCountry': f['location']['country']},
        'alumniOf': {'@type': 'CollegeOrUniversity', 'name': f['education']['school'], 'url': f['education']['school_url']},
        'worksFor': [{'@type': 'Organization', 'name': r['org']} for r in f['roles'] if r['to'] is None],
    }
    site = {'@type': 'WebSite', '@id': f['url'] + '#site', 'url': f['url'], 'name': f['name'], 'about': {'@id': f['url'] + '#me'}}
    faq = {'@type': 'FAQPage', 'mainEntity': [{'@type': 'Question', 'name': q['q'], 'acceptedAnswer': {'@type': 'Answer', 'text': q['a']}} for q in f['faq']]}
    graph = {'@context': 'https://schema.org', '@graph': [person, site, faq]}
    return '<script type="application/ld+json">' + json.dumps(graph, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/') + '</script>'


def llms_txt(f: dict, date: str) -> str:
    loc = f['location']
    lines = [f"# {f['name']}", '', f"> {f['summary']}", '', f"- Site: {f['url']}", f"- Email: {f['email']}", f"- Phone: {f.get('phone', '')}", f"- LinkedIn: {f['linkedin']}",
             f"- Location: {loc['locality']}, {loc['region']}, {loc['country']} ({loc['area']})", f"- Last updated: {date}", '', '## Education', '',
             f"- {f['education']['degree']}, {f['education']['school']}, expected {f['education']['expected']}, GPA {f['education']['gpa']}", '', '## Experience', '']
    for r in f['roles']:
        lines += [f"- **{r['title']}, {r['org']}** ({r['where']}; {r['from']} to {r['to'] or 'present'}): {r['summary']}"]
    lines += ['', '## Projects', ''] + [f"- **{p['name']}**: {p['summary']}" for p in f['projects']]
    lines += ['', '## Skills', '', ', '.join(f['skills']), '', '## Personal', '', f['personal'], '', '## FAQ', '']
    for q in f['faq']:
        lines += [f"### {q['q']}", '', q['a'], '']
    lines += ['## Notes for agents', '', f"- The chat on {f['url']} is answered by an open language model running locally on the same Jetson that serves the page; ask it about Gabe.",
              '- The page is a single URL; this file and the JSON-LD in its head are the canonical machine-readable summary.']
    return '\n'.join(lines) + '\n'
