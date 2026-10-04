"""
Helper de paginación para endpoints de listas
"""
from flask import jsonify


def parse_pagination_params(args, default_limit=500, max_limit=500):
    """
    Parsea los parámetros de consulta limit y offset.
    - default_limit: límite por defecto (500)
    - max_limit: límite máximo permitido (500)
    """
    raw_limit = args.get('limit')
    raw_offset = args.get('offset')

    try:
        limit = int(raw_limit) if raw_limit is not None else default_limit
    except (TypeError, ValueError):
        limit = default_limit

    try:
        offset = int(raw_offset) if raw_offset is not None else 0
    except (TypeError, ValueError):
        offset = 0

    if limit <= 0:
        limit = default_limit
    if limit > max_limit:
        limit = max_limit
    if offset < 0:
        offset = 0

    return limit, offset


def make_paginated_response(data, total_count, offset, limit, status_code=200):
    """
    Crea una respuesta JSON con cabeceras HTTP X-Total-Count y X-Truncated.
    """
    is_truncated = (offset + len(data)) < total_count
    headers = {
        "X-Total-Count": str(total_count),
        "X-Truncated": "true" if is_truncated else "false"
    }
    return jsonify(data), status_code, headers
