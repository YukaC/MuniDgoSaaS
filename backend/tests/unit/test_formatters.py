"""Tests para formatters - Sin dependencias de BD"""
import pytest
import sys
import os
from datetime import datetime

# Agregar backend al path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))


class TestFormatTurnoRow:
    """Tests para format_turno_row"""
    
    def test_format_complete_row(self):
        """Test con todos los campos"""
        from api.utils.formatters import format_turno_row
        
        row = (
            1,  # id
            1,  # empresa_id
            2,  # profesional_id
            3,  # servicio_id
            'Juan Pérez',  # cliente_name
            'Observaciones',  # observaciones
            datetime(2026, 1, 15, 10, 0, 0),  # start_datetime
            'Reservado',  # status
            datetime(2026, 1, 10, 8, 0, 0),  # created_at
            'Dr.',  # profesional_nombre
            'García',  # profesional_apellido
            'Cardiología',  # profesional_especialidad
            'Consulta',  # servicio_nombre
            100.0,  # precio
            'Hospital'  # empresa_nombre
        )
        
        result = format_turno_row(row)
        
        assert result['id'] == 1
        assert result['cliente_name'] == 'Juan Pérez'
        assert result['status'] == 'Reservado'
        assert result['profesional_especialidad'] == 'Cardiología'
        assert result['precio'] == 100.0
    
    def test_format_none_row(self):
        """Test con None"""
        from api.utils.formatters import format_turno_row
        result = format_turno_row(None)
        assert result is None
    
    def test_format_row_with_missing_optional_fields(self):
        """Test con campos opcionales vacíos"""
        from api.utils.formatters import format_turno_row
        
        row = (1, 1, 2, None, 'Cliente', None, datetime.now(), 'Reservado', 
               datetime.now(), 'Dr', 'García', None, None, None)
        
        result = format_turno_row(row)
        
        assert result['servicio_id'] is None
        assert result['observaciones'] is None
        assert result['profesional_especialidad'] == 'Consulta General'
        assert result['precio'] == 0


class TestFormatClienteRow:
    """Tests para format_cliente_row"""
    
    def test_format_complete_cliente(self):
        """Test con cliente completo"""
        from api.utils.formatters import format_cliente_row
        
        row = (1, '12345678', 'Juan', 'Pérez', 'juan@email.com', '1234567890')
        
        result = format_cliente_row(row)
        
        assert result['id'] == 1
        assert result['dni'] == '12345678'
        assert result['nombre'] == 'Juan'
        assert result['apellido'] == 'Pérez'
        assert result['email'] == 'juan@email.com'
        assert result['telefono'] == '1234567890'
    
    def test_format_none(self):
        """Test con None"""
        from api.utils.formatters import format_cliente_row
        result = format_cliente_row(None)
        assert result is None


class TestFormatHorarioSlot:
    """Tests para format_horario_slot"""
    
    def test_format_slot(self):
        """Test de formateo de slot"""
        from api.utils.formatters import format_horario_slot
        
        hora = datetime(2026, 1, 15, 10, 30, 0)
        
        result = format_horario_slot(hora)
        
        assert result['hora'] == '10:30'
        assert result['datetime'] == '2026-01-15 10:30:00'


class TestFormatLists:
    """Tests para funciones de lista"""
    
    def test_format_turno_list_empty(self):
        """Test con lista vacía"""
        from api.utils.formatters import format_turno_list
        result = format_turno_list([])
        assert result == []
    
    def test_format_cliente_list_with_none(self):
        """Test que filtra None"""
        from api.utils.formatters import format_cliente_list
        
        rows = [
            (1, '111', 'A', 'A', 'a@a.com', '111'),
            None,
            (2, '222', 'B', 'B', 'b@b.com', '222')
        ]
        
        result = format_cliente_list(rows)
        
        assert len(result) == 2
        assert result[0]['id'] == 1
        assert result[1]['id'] == 2
