import sys, textwrap
times = [tuple(map(float, p.split(','))) for p in open(sys.argv[1]).read().strip().split(';')]
lines = open(sys.argv[2], encoding='utf-8').read().splitlines()
assert len(times) == len(lines), (len(times), len(lines))
def ts(x):
    ms = round(x * 1000); h, ms = divmod(ms, 3600000); m, ms = divmod(ms, 60000); s, ms = divmod(ms, 1000)
    return f"{h:02}:{m:02}:{s:02},{ms:03}"
out = []
for i, ((s, e), t) in enumerate(zip(times, lines), 1):
    body = '\n'.join(textwrap.wrap(t, 46)) if len(t) > 46 else t
    out.append(f"{i}\n{ts(s)} --> {ts(e)}\n{body}\n")
open(sys.argv[3], 'w', encoding='utf-8').write('\n'.join(out))
