from flask import request, jsonify
from api.models.Servicios import Servicio
from api.utils.seguridad import requiere_token, misma_empresa
from api import app

# ---------------------- OBTENER TODOS ----------------------
@app.route('/servicios', methods=['GET'])
@requiere_token
def obtener_servicios():
    try:
        servicios = Servicio.get_servicios()
        return jsonify(servicios), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500
    

    # ---------------------- OBTENER POR EMPRESA ----------------------
@app.route('/empresa/<int:id_empresa>/servicios', methods=['GET'])
@requiere_token
def obtener_servicios_por_empresa(id_empresa):
    try:
        servicios = Servicio.get_servicios_by_idempresa(id_empresa)
        return jsonify(servicios), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500


# ---------------------- OBTENER UNO ----------------------
@app.route('/empresa/<int:id_empresa>/servicio/<int:id>', methods=['GET'])
@requiere_token
@misma_empresa(tabla='servicios')
def obtener_servicio(id_empresa,id):
    try:
        servicio = Servicio.get_servicio_by_id(id)
        if servicio is None:
            return jsonify({"message": "Servicio no encontrado"}), 404
        return jsonify(servicio), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500


# ---------------------- CREAR ----------------------
@app.route('/servicio', methods=['POST'])
@requiere_token
def crear_servicio():
    datos = request.get_json()

    datos['empresa_id'] = int(request.headers['id-empresa'])

    try:
        nuevo = Servicio.create_servicio(datos)
        return jsonify(nuevo), 201
    except ValueError as e:
        return jsonify({"message": str(e)}), 400
    except Exception as e:
        return jsonify({"message": str(e)}), 500


# ---------------------- ACTUALIZAR ----------------------
@app.route('/empresa/<int:id_empresa>/servicio/<int:id>', methods=['PUT'])
@requiere_token
@misma_empresa(tabla='servicios')
def actualizar_servicio(id,id_empresa):
    datos = request.get_json()

    datos['empresa_id'] = int(id_empresa)

    try:
        actualizado = Servicio.update_servicio(id, datos)
        return jsonify(actualizado), 200
    except ValueError as e:
        return jsonify({"message": str(e)}), 400
    except Exception as e:
        return jsonify({"message": str(e)}), 500


# ---------------------- ELIMINAR ----------------------
@app.route('/empresa/<int:id_empresa>/servicio/<int:id>', methods=['DELETE'])
@requiere_token
@misma_empresa(tabla='servicios')
def eliminar_servicio(id,id_empresa):
    try:
        eliminado = Servicio.delete_servicio(id)
        return jsonify(eliminado), 200
    except ValueError as e:
        return jsonify({"message": str(e)}), 404
    except Exception as e:
        return jsonify({"message": str(e)}), 500
