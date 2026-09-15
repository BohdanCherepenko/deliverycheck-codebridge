#!/usr/bin/env python3
"""Add the isolated DeliveryCheck route without replacing unrelated Caddy config."""

from __future__ import annotations

import sys
from pathlib import Path


SITE_HEADER = "fridayfunded.com {"
MATCHER = "@deliveryCheck path /codebridge /codebridge/*"
UPSTREAM = "reverse_proxy 127.0.0.1:3100"
DIRECT_UPSTREAM = "reverse_proxy @deliveryCheck 127.0.0.1:3100"
BODY_LIMIT = "max_size 27787264"


def site_bounds(lines: list[str]) -> tuple[int, int]:
    starts = [index for index, line in enumerate(lines) if line.strip() == SITE_HEADER]
    if len(starts) != 1:
        raise ValueError(f"Expected one exact {SITE_HEADER!r} block, found {len(starts)}.")

    start = starts[0]
    depth = 0
    for index in range(start, len(lines)):
        depth += lines[index].count("{") - lines[index].count("}")
        if index > start and depth == 0:
            return start, index
    raise ValueError("The fridayfunded.com Caddy block is not balanced.")


def merge(source: str) -> str:
    lines = source.splitlines(keepends=True)
    start, end = site_bounds(lines)
    block = "".join(lines[start : end + 1])
    has_matcher = MATCHER in block
    has_upstream = UPSTREAM in block or DIRECT_UPSTREAM in block
    has_body_limit = BODY_LIMIT in block

    if has_matcher and has_upstream and has_body_limit:
        return source
    if has_matcher and has_upstream and not has_body_limit:
        delivery_handle = next(
            (
                index
                for index in range(start + 1, end)
                if lines[index].strip() == "handle @deliveryCheck {"
            ),
            None,
        )
        if delivery_handle is not None:
            indent = lines[delivery_handle][
                : len(lines[delivery_handle]) - len(lines[delivery_handle].lstrip())
            ]
            body_guard = [
                f"{indent}    request_body {{\n",
                f"{indent}        {BODY_LIMIT}\n",
                f"{indent}    }}\n",
            ]
            lines[delivery_handle + 1 : delivery_handle + 1] = body_guard
            return "".join(lines)

        direct_proxy = next(
            (
                index
                for index in range(start + 1, end)
                if lines[index].strip() == DIRECT_UPSTREAM
            ),
            None,
        )
        if direct_proxy is not None:
            indent = lines[direct_proxy][
                : len(lines[direct_proxy]) - len(lines[direct_proxy].lstrip())
            ]
            body_guard = [
                f"{indent}request_body @deliveryCheck {{\n",
                f"{indent}    {BODY_LIMIT}\n",
                f"{indent}}}\n",
            ]
            lines[direct_proxy:direct_proxy] = body_guard
            return "".join(lines)

        raise ValueError("Could not attach a body limit to the existing DeliveryCheck route.")

    if has_matcher or has_upstream or has_body_limit:
        raise ValueError("An incomplete DeliveryCheck Caddy route already exists.")

    catch_all = next(
        (index for index in range(start + 1, end) if lines[index].strip() == "handle {"),
        None,
    )
    if catch_all is not None:
        indent = lines[catch_all][: len(lines[catch_all]) - len(lines[catch_all].lstrip())]
        route = [
            f"{indent}{MATCHER}\n",
            f"{indent}handle @deliveryCheck {{\n",
            f"{indent}    request_body {{\n",
            f"{indent}        {BODY_LIMIT}\n",
            f"{indent}    }}\n",
            f'{indent}    header X-Robots-Tag "noindex, nofollow, noarchive"\n',
            f"{indent}    {UPSTREAM}\n",
            f"{indent}}}\n",
            "\n",
        ]
        lines[catch_all:catch_all] = route
        return "".join(lines)

    fallback = next(
        (
            index
            for index in range(start + 1, end)
            if lines[index].strip() == "reverse_proxy 127.0.0.1:8000"
        ),
        None,
    )
    if fallback is None:
        raise ValueError("Could not find the Friday catch-all proxy anchor.")

    indent = lines[fallback][: len(lines[fallback]) - len(lines[fallback].lstrip())]
    route = [
        f"{indent}{MATCHER}\n",
        f"{indent}request_body @deliveryCheck {{\n",
        f"{indent}    {BODY_LIMIT}\n",
        f"{indent}}}\n",
        f'{indent}header @deliveryCheck X-Robots-Tag "noindex, nofollow, noarchive"\n',
        f"{indent}reverse_proxy @deliveryCheck 127.0.0.1:3100\n",
    ]
    lines[fallback:fallback] = route
    return "".join(lines)


def main() -> int:
    if len(sys.argv) != 3:
        print("usage: merge_deliverycheck_caddy.py INPUT OUTPUT", file=sys.stderr)
        return 2

    source_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])
    try:
        output_path.write_text(merge(source_path.read_text(encoding="utf-8")), encoding="utf-8")
    except (OSError, ValueError) as error:
        print(f"Caddy merge failed: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
