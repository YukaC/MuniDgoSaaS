from flask import request, jsonify
from api.models.Profesionales import Profesional
from api.utils.seguridad import requiere_token, misma_empresa
from api import app

# ---------------------- OBTENER TODOS ----------------------
@app.route('/profesionales', methods=['GET'])
@requiere_token
def obtener_profesionales():
    try:
        profesionales = Profesional.get_profesionales()
        return jsonify(profesionales), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500


# ---------------------- OBTENER POR EMPRESA ----------------------
@app.route('/empresa/<int:id_empresa>/profesionales', methods=['GET'])
@requiere_token
def obtener_profesionales_por_empresa(id_empresa):
    try:
        profesionales = Profesional.get_profesionales_by_idempresa(id_empresa)
        return jsonify(profesionales), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500


# ---------------------- OBTENER UNO POR ID ----------------------
@app.route('/empresa/<int:id_empresa>/profesional/<int:id>', methods=['GET'])
@requiere_token
@misma_empresa(tabla='profesionales')
def obtener_profesional(id,id_empresa):
    try:
        profesional = Profesional.get_profesional_by_id(id)
        if profesional is None:
            return jsonify({"message": "Profesional no encontrado"}), 404
        
        return jsonify(profesional), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500


# ---------------------- CREAR ----------------------
@app.route('/profesional', methods=['POST'])
@requiere_token
def crear_profesional():
    datos = request.get_json()

    datos['empresa_id'] = int(request.headers['id-empresa'])

    try:
        nuevo = Profesional.create_profesional(datos)
        return jsonify(nuevo), 201
    except ValueError as e:
        return jsonify({"message": str(e)}), 400
    except Exception as e:
        return jsonify({"message": str(e)}), 500


# ---------------------- ACTUALIZAR ----------------------
@app.route('/empresa/<int:id_empresa>/profesional/<int:id>', methods=['PUT'])
@requiere_token
@misma_empresa(tabla='profesionales')
def actualizar_profesional(id_empresa,id):
    datos = request.get_json()

    datos['empresa_id'] = int(id_empresa)

    try:
        actualizado = Profesional.update_profesional(id, datos)
        return jsonify(actualizado), 200
    except ValueError as e:
        return jsonify({"message": str(e)}), 400
    except Exception as e:
        return jsonify({"message": str(e)}), 500


# ---------------------- ELIMINAR ----------------------
@app.route('/empresa/<int:id_empresa>/profesional/<int:id>', methods=['DELETE'])
@requiere_token
@misma_empresa(tabla='profesionales')
def eliminar_profesional(id_empresa,id):
    try:
        eliminado = Profesional.delete_profesional(id)
        return jsonify(eliminado), 200
    except ValueError as e:
        return jsonify({"message": str(e)}), 404
    except Exception as e:
        return jsonify({"message": str(e)}), 500
