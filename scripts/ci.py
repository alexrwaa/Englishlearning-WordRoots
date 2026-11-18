"""CI helpers that use the credential git already stores (never printed).

    python scripts/ci.py logs [run_id]        # tail of failed steps
    python scripts/ci.py artifact <id> <dest> # download an artifact zip
    python scripts/ci.py runs [n]             # recent runs

Read-only: only GET requests.
"""
import io
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
import zipfile

REPO = "alexrwaa/Englishlearning-WordRoots"


def token():
    out = subprocess.run(
        ["git", "credential", "fill"],
        input="protocol=https\nhost=github.com\n\n",
        capture_output=True,
        text=True,
        check=True,
    ).stdout
    for line in out.splitlines():
        if line.startswith("password="):
            return line[len("password=") :]
    return ""


TOK = token()


def get(path, raw=False):
    req = urllib.request.Request(
        f"https://api.github.com{path}",
        headers={
            "Authorization": f"token {TOK}",
            "Accept": "application/vnd.github+json",
            "User-Agent": "wordroots-ci",
        },
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = resp.read()
        return data if raw else json.loads(data)


def cmd_runs(n=5):
    runs = get(f"/repos/{REPO}/actions/runs?per_page={n}")["workflow_runs"]
    for r in runs:
        print(r["id"], r["name"], r["head_sha"][:7], r["status"], r["conclusion"])


def cmd_logs(run_id=None):
    if run_id is None:
        run_id = get(f"/repos/{REPO}/actions/runs?per_page=1")["workflow_runs"][0]["id"]
    jobs = get(f"/repos/{REPO}/actions/runs/{run_id}/jobs")["jobs"]
    for job in jobs:
        if job["conclusion"] == "success":
            continue
        print(f"### job {job['name']} -> {job['conclusion']}")
        try:
            raw = get(f"/repos/{REPO}/actions/jobs/{job['id']}/logs", raw=True)
        except urllib.error.HTTPError as e:
            print("  logs unavailable:", e.code)
            continue
        text = raw.decode("utf-8", "replace")
        lines = [ln for ln in text.splitlines() if ln.strip()]
        for ln in lines[-60:]:
            print("  " + ln[:400])


class _StripAuthOnRedirect(urllib.request.HTTPRedirectHandler):
    """Artifact downloads redirect to a signed blob URL that rejects our token."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        new = super().redirect_request(req, fp, code, msg, headers, newurl)
        if new is not None:
            new.headers.pop("Authorization", None)
        return new


def _download(url):
    opener = urllib.request.build_opener(_StripAuthOnRedirect())
    req = urllib.request.Request(
        url,
        headers={
            "Authorization": f"token {TOK}",
            "Accept": "application/vnd.github+json",
            "User-Agent": "wordroots-ci",
        },
    )
    with opener.open(req, timeout=180) as resp:
        return resp.read()


def cmd_jobs(run_id):
    d = get(f"/repos/{REPO}/actions/runs/{run_id}/jobs")
    if "jobs" not in d:
        print(json.dumps(d)[:400])
        return
    for j in d["jobs"]:
        print(f"JOB {j['name']} -> {j['conclusion']}")
        for s in j["steps"]:
            mark = "FAIL" if s["conclusion"] not in ("success", "skipped", None) else "ok"
            print(f"  {mark:4} {s['number']:>2} {s['name']} -> {s['status']}/{s['conclusion']}")


def cmd_checks(sha):
    d = get(f"/repos/{REPO}/commits/{sha}/check-runs?per_page=20")
    for c in d.get("check_runs", []):
        print(f"{c['name']} -> {c['conclusion']}")
        ann = get(f"/repos/{REPO}/check-runs/{c['id']}/annotations")
        for a in ann if isinstance(ann, list) else []:
            print(f"  [{a.get('annotation_level')}] {a.get('path')}:{a.get('start_line')} {a.get('message')}")


def cmd_artifact(art_id, dest):
    raw = _download(f"https://api.github.com/repos/{REPO}/actions/artifacts/{art_id}/zip")
    os.makedirs(dest, exist_ok=True)
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        z.extractall(dest)
        print("\n".join(z.namelist()[:10]))
    print("extracted to", dest)


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "runs"
    if cmd == "runs":
        cmd_runs(int(sys.argv[2]) if len(sys.argv) > 2 else 5)
    elif cmd == "logs":
        cmd_logs(int(sys.argv[2]) if len(sys.argv) > 2 else None)
    elif cmd == "jobs":
        cmd_jobs(sys.argv[2])
    elif cmd == "checks":
        cmd_checks(sys.argv[2])
    elif cmd == "artifact":
        cmd_artifact(sys.argv[2], sys.argv[3])
    else:
        print(__doc__)
