"""Move the page between index.html and the claude.ai artifact.

    python3 tools/artifact_sync.py to-artifact OUT.html
        Writes the artifact page content built from index.html. The Artifact tool
        wraps it in its own <!doctype>/<head> skeleton, so the file holds only the
        page: the head tags (title, meta, links) followed by the body, between
        <!--page:start--> and <!--page:end--> markers. The editor saves the page
        from between these markers.

    python3 tools/artifact_sync.py from-artifact SAVED.html
        Rewrites index.html from a saved artifact version (the full HTML of the
        page as the artifact stores it, skeleton included).

The two directions are exact inverses, so a save that changed nothing leaves
index.html byte-for-byte the same and git shows only real edits.
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
INDEX = ROOT / 'index.html'
HEAD_OPEN = ('<!doctype html>\n<html lang="en" data-lang="en">\n<head>\n<meta charset="utf-8">\n'
             '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n')
HEAD_CLOSE = '</head>\n<body>\n'
DOC_CLOSE = '</body>\n</html>\n'
START, END = '<!--page:start-->', '<!--page:end-->'


def to_artifact(index: str) -> str:
    if not index.startswith(HEAD_OPEN):
        raise SystemExit('index.html does not start with the expected <head>; was it edited by hand?')
    head, rest = index[len(HEAD_OPEN):].split(HEAD_CLOSE, 1)
    if not rest.endswith(DOC_CLOSE):
        raise SystemExit('index.html does not end with </body></html>')
    return START + '\n' + head + rest[:-len(DOC_CLOSE)] + END


def from_artifact(saved: str) -> str:
    try:
        inner = saved[saved.index(START + '\n') + len(START) + 1:saved.index(END)]
    except ValueError:
        raise SystemExit('No <!--page:start--> / <!--page:end--> markers in the saved page.')
    head = re.match(r'(?:<(?:title|meta|link)\b[^\n]*\n)+', inner)
    if not head:
        raise SystemExit('The saved page does not start with its <title>/<meta>/<link> tags.')
    return HEAD_OPEN + head.group(0) + HEAD_CLOSE + inner[head.end():] + DOC_CLOSE


def main(argv):
    if len(argv) != 3 or argv[1] not in ('to-artifact', 'from-artifact'):
        raise SystemExit(__doc__)
    path = pathlib.Path(argv[2])
    if argv[1] == 'to-artifact':
        path.write_text(to_artifact(INDEX.read_text(encoding='utf-8')), encoding='utf-8')
        print(f'wrote {path}')
    else:
        new = from_artifact(path.read_text(encoding='utf-8'))
        old = INDEX.read_text(encoding='utf-8')
        INDEX.write_text(new, encoding='utf-8')
        print('index.html unchanged' if new == old else 'index.html updated')


if __name__ == '__main__':
    main(sys.argv)
