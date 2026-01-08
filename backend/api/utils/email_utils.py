import os
import threading
import logging
from datetime import datetime
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from api.db.db_config import get_db_connection

# Configuración básica de logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def enviar_email_confirmacion(turno_id):
    """
    Busca los datos del turno y del cliente, y envía un correo electrónico de confirmación.
    """
    logger.info(f"Iniciando proceso de envío de email para el turno {turno_id}")
    
    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)
        
        # Obtener datos del turno, empresa y cliente
        query = """
            SELECT 
                t.id, t.start_datetime, t.cliente_name,
                e.nombre as empresa_nombre,
                p.name as profesional_nombre, p.surname as profesional_apellido,
                c.email as cliente_email
            FROM turnos t
            JOIN empresas e ON t.empresa_id = e.id
            JOIN profesionales p ON t.profesional_id = p.id
            LEFT JOIN clientes c ON t.cliente_name = CONCAT(c.nombre, ' ', c.apellido)
            WHERE t.id = %s
        """
        cursor.execute(query, (turno_id,))
        datos = cursor.fetchone()
        
        cursor.close()
        connection.close()
        
        if not datos:
            logger.error(f"No se encontraron datos para el turno {turno_id}")
            return

        email_cliente = datos.get('cliente_email')
        if not email_cliente:
            logger.info(f"El cliente {datos['cliente_name']} no tiene un email registrado. Abortando envío.")
            return

        # Configuración del servidor SMTP (usando variables de entorno o valores por defecto para pruebas)
        smtp_server = os.getenv("SMTP_SERVER", "smtp.gmail.com")
        smtp_port = int(os.getenv("SMTP_PORT", 587))
        smtp_user = os.getenv("SMTP_USER", "")
        smtp_password = os.getenv("SMTP_PASSWORD", "")
        
        if not smtp_user or not smtp_password:
            logger.warning("Configuración SMTP incompleta. El correo no se enviará, pero se registrará en el log.")
            logger.info(f"SIMULACIÓN DE EMAIL: De: info@miturno.com Para: {email_cliente}")
            logger.info(f"Asunto: Confirmación de Turno - {datos['empresa_nombre']}")
            logger.info(f"Mensaje: Hola {datos['cliente_name']}, tu turno con {datos['profesional_nombre']} {datos['profesional_apellido']} para el {datos['start_datetime']} ha sido registrado exitosamente.")
            return

        # Crear el mensaje
        msg = MIMEMultipart()
        msg['From'] = smtp_user
        msg['To'] = email_cliente
        msg['Subject'] = f"Confirmación de Turno - {datos['empresa_nombre']}"

        cuerpo = f"""
        Hola {datos['cliente_name']},
        
        Te confirmamos que tu turno ha sido registrado exitosamente:
        
        Lugar: {datos['empresa_nombre']}
        Profesional: {datos['profesional_nombre']} {datos['profesional_apellido']}
        Fecha y Hora: {datos['start_datetime']}
        
        ¡Gracias por usar nuestro sistema!
        """
        msg.attach(MIMEText(cuerpo, 'plain'))

        # Enviar el correo
        with smtplib.SMTP(smtp_server, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_password)
            server.send_message(msg)
            
        logger.info(f"Email enviado exitosamente a {email_cliente} para el turno {turno_id}")

    except Exception as e:
        logger.error(f"Error al enviar email para el turno {turno_id}: {str(e)}")

def programar_email_confirmacion(turno_id):
    """
    Programa el envío del email de confirmación después de 15 minutos (900 segundos).
    """
    logger.info(f"Programando email de confirmación para el turno {turno_id} en 15 minutos")
    # Para propósitos de demostración/prueba rápida, podrías reducirlo a 60 segundos si el usuario lo pide
    # Pero respetaremos los 15 minutos solicitados.
    timer = threading.Timer(900, enviar_email_confirmacion, args=[turno_id])
    timer.start()
