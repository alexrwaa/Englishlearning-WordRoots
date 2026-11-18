"""Delete a GitHub release and its tag using the credential git already stores.

Used once to remove a premature v0.2.0 release that the old workflow created
before the immutable-release rules existed. Prints status codes only.
"""
import json
import subprocess
import sys
import urllib.error
import urllib.request

REPO = "alexrwaa/Englishlearning-WordRoots"
TAG = sys.argv[1] if len(sys.argv) > 1 else "v0.2.0"


def credential():
    out = subprocess.run(
        ["git", "credential", "fill"],
        input="protocol=https\nhost=github.com\n\n",
        capture_output=True,
        text=True,
        check=True,
    ).stdout
    token = ""
    for line in out.splitlines():
        if line.startswith("password="):
            token = line[len("password=") :]
    return token


def api(method, path, token):
    req = urllib.request.Request(
        f"https://api.github.com{path}",
        method=method,
        headers={
            "Authorization": f"token {token}",
            "Accept": "application/vnd.github+json",
            "User-Agent": "wordroots-release-cleanup",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = resp.read().decode()
            return resp.status, body
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


def main():
    token = credential()
    if not token:
        print("no stored credential")
        return 1

    status, body = api("GET", f"/repos/{REPO}/releases/tags/{TAG}", token)
    print("get release:", status)
    if status == 200:
        rel = json.loads(body)
        print("  release id:", rel["id"], "target:", rel["target_commitish"])
        status, _ = api("DELETE", f"/repos/{REPO}/releases/{rel['id']}", token)
        print("delete release:", status)

    status, body = api("GET", f"/repos/{REPO}/git/refs/tags/{TAG}", token)
    print("get tag ref:", status)
    if status == 200:
        status, _ = api("DELETE", f"/repos/{REPO}/git/refs/tags/{TAG}", token)
        print("delete tag ref:", status)

    status, body = api("GET", f"/repos/{REPO}/releases/tags/{TAG}", token)
    print("release after cleanup:", status)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
