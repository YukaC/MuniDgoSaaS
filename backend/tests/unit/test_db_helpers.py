"""Tests para db_helpers - Sin dependencias de BD"""
import pytest
import sys
import os

# Agregar backend al path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))


class TestWeekdayConversions:
    """Tests para conversión de días de la semana"""
    
    def test_python_to_db_monday(self):
        """Lunes en Python (0) -> Lunes en BD (1)"""
        from api.utils.db_helpers import python_weekday_to_db
        assert python_weekday_to_db(0) == 1
    
    def test_python_to_db_sunday(self):
        """Domingo en Python (6) -> Domingo en BD (0)"""
        from api.utils.db_helpers import python_weekday_to_db
        assert python_weekday_to_db(6) == 0
    
    def test_python_to_db_saturday(self):
        """Sábado en Python (5) -> Sábado en BD (6)"""
        from api.utils.db_helpers import python_weekday_to_db
        assert python_weekday_to_db(5) == 6
    
    def test_db_to_python_monday(self):
        """Lunes en BD (1) -> Lunes en Python (0)"""
        from api.utils.db_helpers import db_weekday_to_python
        assert db_weekday_to_python(1) == 0
    
    def test_db_to_python_sunday(self):
        """Domingo en BD (0) -> Domingo en Python (6)"""
        from api.utils.db_helpers import db_weekday_to_python
        assert db_weekday_to_python(0) == 6
    
    def test_roundtrip_conversion(self):
        """Verificar que la conversión ida y vuelta es consistente"""
        from api.utils.db_helpers import python_weekday_to_db, db_weekday_to_python
        for python_day in range(7):
            db_day = python_weekday_to_db(python_day)
            back_to_python = db_weekday_to_python(db_day)
            assert back_to_python == python_day


class TestDiasSemana:
    """Tests para el diccionario DIAS_SEMANA"""
    
    def test_all_days_present(self):
        """Verificar que todos los días están presentes"""
        from api.utils.db_helpers import DIAS_SEMANA
        assert len(DIAS_SEMANA) == 7
    
    def test_sunday(self):
        from api.utils.db_helpers import DIAS_SEMANA
        assert DIAS_SEMANA[0] == "Domingo"
    
    def test_monday(self):
        from api.utils.db_helpers import DIAS_SEMANA
        assert DIAS_SEMANA[1] == "Lunes"
    
    def test_saturday(self):
        from api.utils.db_helpers import DIAS_SEMANA
        assert DIAS_SEMANA[6] == "Sábado"
