from api import app
from api.models.Empresas import Empresa
from api.utils.seguridad import requiere_token
from api.utils.rate_limit import rate_limit_login
from flask import request, jsonify

# ----------------------------
#   CREATE (Registrar Empresa)
# ----------------------------
@app.route("/registro", methods=["POST"])
def registrar_empresa():
    datos = request.get_json()
    try:
        nuevo = Empresa.register(datos)
        return jsonify(nuevo), 201
    except Exception as e:
        return jsonify({"message": str(e)}), 400


# ----------------------------
#   LOGIN (Protegido contra fuerza bruta)
# ----------------------------
@app.route("/login", methods=["POST"])
@rate_limit_login
def login_empresa():
    auth = request.authorization
    try:
        empresa = Empresa.login(auth)
        return jsonify(empresa), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 401


# ----------------------------
#   GET ALL Empresas
# ----------------------------
@app.route("/empresas", methods=["GET"])
@requiere_token
def get_empresas():
    try:
        empresas = Empresa.get_empresas()
        return jsonify(empresas), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 400


# ----------------------------
#   GET Empresa by ID
# ----------------------------
@app.route("/empresa/<int:id_empresa>", methods=["GET"])
@requiere_token
def get_empresa_id(id_empresa):
    try:
        empresa = Empresa.get_empresa_by_id(id_empresa)
        if empresa:
            return jsonify(empresa), 200
        return jsonify({"message": "Empresa no encontrada"}), 404
    except Exception as e:
        return jsonify({"message": str(e)}), 400


# ----------------------------
#   GET Empresa by username
# ----------------------------
@app.route("/empresa/usuario/<string:username>", methods=["GET"])
def get_empresa_username(username):
    try:
        empresa = Empresa.get_empresa_by_username(username)
        if empresa:
            return jsonify(empresa), 200
        return jsonify({"message": "Empresa no encontrada"}), 404
    except Exception as e:
        return jsonify({"message": str(e)}), 400


# ----------------------------
#   UPDATE Empresa
# ----------------------------
@app.route("/empresa/<int:id_empresa>", methods=["PUT"])
@requiere_token
def actualizar_empresa(id_empresa):
    datos = request.get_json()
    try:
        actualizado = Empresa.update_empresa(id_empresa, datos)
        return jsonify(actualizado), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 400


# ----------------------------
#   DELETE Empresa
# ----------------------------
@app.route("/empresa/<int:id_empresa>", methods=["DELETE"])
@requiere_token
def eliminar_empresa(id_empresa):
    try:
        eliminado = Empresa.delete_empresa(id_empresa)
        return jsonify(eliminado), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 400