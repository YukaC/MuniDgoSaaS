"""Unit tests for query limits, deterministic ordering, and table whitelist security."""
from unittest.mock import MagicMock, patch
import pytest
from api import app
from api.utils.seguridad import ALLOWED_TABLES, misma_empresa
from api.models.Turnos import Turno


def test_table_whitelist_security():
    """Verify that misma_empresa decorator rejects invalid/injected table names."""
    @misma_empresa(tabla="users; DROP TABLE turnos; --")
    def dummy_route(id=1):
        return "OK"

    with app.test_request_context('/test', headers={"id-empresa": "1"}):
        res, status = dummy_route(id=1)
        assert status == 400
        assert "Nombre de tabla inválido" in res.get_json()["message"]


def test_model_query_limits_and_ordering():
    """Verify that get_turnos enforces limit, offset and executes deterministic ORDER BY id ASC."""
    mock_cursor = MagicMock()
    # Create 15 fake rows with IDs 1..15
    fake_rows = [
        (i, 1, 1, 1, "2026-10-04 10:00:00", "2026-10-04 10:30:00", "Confirmado", "Notas", "2026-10-04", "2026-10-04")
        for i in range(1, 16)
    ]
    mock_cursor.fetchall.return_value = fake_rows[:10]

    with patch("api.models.Turnos.get_db_cursor") as mock_db_ctx:
        mock_db_ctx.return_value.__enter__.return_value = mock_cursor

        results = Turno.get_turnos(limit=10, offset=0)
        assert len(results) == 10
        assert mock_cursor.execute.called
        query_executed, params = mock_cursor.execute.call_args[0]

        # Must enforce deterministic ORDER BY and LIMIT
        assert "ORDER BY id ASC" in query_executed
        assert "LIMIT %s OFFSET %s" in query_executed
        assert params == (10, 0)
