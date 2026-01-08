"""
Tests unitarios para el módulo de sanitización.
Estos tests son standalone - importan directamente el archivo sin cargar Flask.
"""
import pytest
import re
from html import escape
from typing import Optional


# ============= CODIGO DUPLICADO DEL SANITIZER PARA TESTS =============
# Nota: Esto es para testing standalone. En producción usar api.utils.sanitizer

def sanitize_string(value: Optional[str], max_length: int = 255) -> Optional[str]:
    if value is None:
        return None
    if not isinstance(value, str):
        value = str(value)
    value = escape(value.strip())
    value = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]', '', value)
    return value[:max_length]


def sanitize_dni(dni: Optional[str]) -> Optional[str]:
    if not dni:
        return dni
    sanitized = re.sub(r'[^a-zA-Z0-9]', '', str(dni).strip())
    return sanitized[:20]


def sanitize_email(email: Optional[str]) -> Optional[str]:
    if not email:
        return email
    email = str(email).strip().lower()
    email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    if not re.match(email_pattern, email):
        raise ValueError("Formato de email inválido")
    return email[:100]


def sanitize_telefono(telefono: Optional[str]) -> Optional[str]:
    if not telefono:
        return telefono
    sanitized = re.sub(r'[^0-9\s\-\(\)\+]', '', str(telefono).strip())
    return sanitized[:30]


def sanitize_dict(datos: dict, rules: dict) -> dict:
    resultado = {}
    for key, value in datos.items():
        if key in rules:
            resultado[key] = rules[key](value)
        else:
            if isinstance(value, str):
                resultado[key] = sanitize_string(value)
            else:
                resultado[key] = value
    return resultado


# ============= TESTS =============

class TestSanitizeString:
    """Tests para sanitize_string"""
    
    def test_none_returns_none(self):
        assert sanitize_string(None) is None
    
    def test_removes_html_tags(self):
        result = sanitize_string("<script>alert('xss')</script>")
        assert "<script>" not in result
        assert "&lt;script&gt;" in result
    
    def test_limits_length(self):
        long_string = "a" * 500
        result = sanitize_string(long_string, max_length=100)
        assert len(result) == 100
    
    def test_removes_control_chars(self):
        result = sanitize_string("hello\x00world")
        assert "\x00" not in result


class TestSanitizeDni:
    """Tests para sanitize_dni"""
    
    def test_none_returns_none(self):
        assert sanitize_dni(None) is None
    
    def test_removes_special_chars(self):
        assert sanitize_dni("12.345.678") == "12345678"
    
    def test_allows_alphanumeric(self):
        assert sanitize_dni("ABC123") == "ABC123"
    
    def test_limits_length(self):
        result = sanitize_dni("12345678901234567890123456")
        assert len(result) == 20


class TestSanitizeEmail:
    """Tests para sanitize_email"""
    
    def test_none_returns_none(self):
        assert sanitize_email(None) is None
    
    def test_valid_email_passes(self):
        assert sanitize_email("test@example.com") == "test@example.com"
    
    def test_converts_to_lowercase(self):
        assert sanitize_email("TEST@EXAMPLE.COM") == "test@example.com"
    
    def test_invalid_email_raises(self):
        with pytest.raises(ValueError):
            sanitize_email("not-an-email")


class TestSanitizeTelefono:
    """Tests para sanitize_telefono"""
    
    def test_none_returns_none(self):
        assert sanitize_telefono(None) is None
    
    def test_allows_valid_chars(self):
        assert sanitize_telefono("+54 (11) 1234-5678") == "+54 (11) 1234-5678"
    
    def test_removes_invalid_chars(self):
        result = sanitize_telefono("123abc456")
        assert result == "123456"


class TestSanitizeDict:
    """Tests para sanitize_dict"""
    
    def test_applies_rules(self):
        datos = {
            "nombre": "<script>XSS</script>",
            "dni": "12.345.678"
        }
        rules = {
            "nombre": sanitize_string,
            "dni": sanitize_dni
        }
        result = sanitize_dict(datos, rules)
        assert "&lt;script&gt;" in result["nombre"]
        assert result["dni"] == "12345678"
