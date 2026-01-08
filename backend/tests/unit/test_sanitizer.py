"""
Tests unitarios para el módulo de sanitización.
"""
import pytest
from api.utils.sanitizer import (
    sanitize_string, sanitize_dni, sanitize_email,
    sanitize_telefono, sanitize_observaciones, sanitize_dict
)


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
