"""Turn the Google Drive links on clips into videos that play inside the phone mockups.

    python3 tools/convert_clips.py

The page editor marks a clip with data-pending when a Drive link is added or
changed. For every such clip in index.html this script:
  1. downloads the video from Google Drive (the file must be shared as
     "Anyone with the link"),
  2. re-encodes it for the mockup: H.264 MP4, at most 720x1280, starts fast,
  3. saves assets/video/<clip>.mp4 and a poster frame assets/img/<clip>-poster.jpg,
  4. puts the <video> into the clip and removes data-pending.
The Drive link stays on the clip (data-drive) so it is clear where the video came from.

Needs curl and ffmpeg.
"""
import html
import pathlib
import re
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
INDEX = ROOT / 'index.html'
VIDEO_DIR = ROOT / 'assets' / 'video'
IMG_DIR = ROOT / 'assets' / 'img'
CLIP = re.compile(r'(<div class="clip" id="clip-([a-z0-9-]+)"([^>]*)>)(.*?)(\n</div>)', re.S)
SCALE = "scale='min(720,iw)':'min(1280,ih)':force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2"


def drive_id(url):
    m = re.search(r'/d/([\w-]{10,})', url) or re.search(r'[?&]id=([\w-]{10,})', url)
    return m.group(1) if m else None


def download(file_id, dest):
    url = f'https://drive.usercontent.google.com/download?id={file_id}&export=download&confirm=t'
    subprocess.run(['curl', '-sSL', '--fail', '--max-time', '900', '-o', str(dest), url], check=True)
    head = dest.read_bytes()[:1024].lower()
    if b'<html' in head or b'<!doctype' in head:
        raise RuntimeError('Drive sent a web page instead of the video: share the file as "Anyone with the link".')


def encode(src, video, poster):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(src), '-vf', SCALE,
                    '-c:v', 'libx264', '-preset', 'slow', '-crf', '27', '-pix_fmt', 'yuv420p',
                    '-movflags', '+faststart', '-c:a', 'aac', '-b:a', '96k', str(video)], check=True)
    probe = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(video)],
                           capture_output=True, text=True, check=True).stdout.strip()
    at = min(1.0, float(probe or 0) / 2)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{at:.2f}', '-i', str(video), '-frames:v', '1',
                    '-vf', 'scale=360:-2', '-q:v', '4', str(poster)], check=True)


def is_wide(video):
    size = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height',
                           '-of', 'csv=p=0', str(video)], capture_output=True, text=True, check=True).stdout.strip()
    w, h = (int(x) for x in size.split(',')[:2])
    return w > h


def attr(text):
    """Escape an attribute value the way the browser writes it back."""
    return text.replace('&', '&amp;').replace('"', '&quot;').replace(' ', '&nbsp;')


def convert(page, fetch=download, make=encode, log=print):
    """Return (new page text, list of files written)."""
    written = []

    def one(m):
        open_tag, slug, attrs, body, close = m.groups()
        if 'data-pending=""' not in attrs:
            return m.group(0)
        link = re.search(r'data-drive="([^"]*)"', attrs)
        file_id = drive_id(html.unescape(link.group(1))) if link else None
        if not file_id:
            log(f'clip-{slug}: no usable Google Drive link, left as it is')
            return m.group(0)
        video, poster = VIDEO_DIR / f'{slug}.mp4', IMG_DIR / f'{slug}-poster.jpg'
        try:
            with tempfile.TemporaryDirectory() as tmp:
                src = pathlib.Path(tmp) / 'source'
                fetch(file_id, src)
                make(src, video, poster)
        except (subprocess.CalledProcessError, RuntimeError, OSError) as e:
            log(f'clip-{slug}: could not convert ({e}); left waiting')
            return m.group(0)
        title = re.search(r'<h3>(.*?)</h3>', body, re.S)
        label = attr(html.unescape(re.sub(r'<[^>]+>', '', title.group(1)))) if title else slug
        wide = ' class="wide"' if is_wide(video) else ''     # landscape video: shown whole, with bars above and below
        tag = (f'<video{wide} data-clip="{slug}" src="assets/video/{slug}.mp4" poster="assets/img/{slug}-poster.jpg" '
               f'controls="" muted="" playsinline="" loop="" preload="none" aria-label="{label} gameplay"></video>')
        body = re.sub(r'<div class="phone">.*?</div>', lambda _: f'<div class="phone">{tag}</div>', body, count=1, flags=re.S)
        written.extend([video, poster])
        log(f'clip-{slug}: {video.stat().st_size / 1e6:.1f} MB video, poster {poster.name}')
        return open_tag.replace(' data-pending=""', '') + body + close

    return CLIP.sub(one, page), written


def main():
    page = INDEX.read_text(encoding='utf-8')
    new, written = convert(page)
    if new != page:
        INDEX.write_text(new, encoding='utf-8')
    if not written:
        print('No clips were waiting for a video.')
    for f in written:
        print('wrote', f.relative_to(ROOT))


if __name__ == '__main__':
    sys.exit(main())
