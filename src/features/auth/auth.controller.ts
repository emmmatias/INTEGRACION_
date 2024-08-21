import { NextFunction, Request, Response } from "express";
import { StatusCode } from "@utils";
import { InstallAppService, AuthService } from "@features/auth";
import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
//import fetch from 'node-fetch'; // Ensure you have this installed
import { json } from "stream/consumers";

const db_path = path.resolve(__dirname, 'users.db');
const vista_path = path.resolve(__dirname, '../../../vistas/registro.pug')
const carrier = {
  "name": "Flash Now Envíos",
  "callback_url": "https://vmpk47rv-8000.brs.devtunnels.ms/costos",
  "types": "ship"
};

const carrier_opt = {
  "code": "express",
  "name": "Servicio de envío Estándar 48hs",
  "allow_free_shipping": true
};

interface TiendaData {
  address: string;
  email: string;
  logo: string;
  metodo_pago: string;
  contacto_tienda: string;
  cp_tienda: string;
  whatsapp_phone_number: string;
  phone: string;
}

let data_tienda: TiendaData;

interface CarrierData {
  id: number;
  callback_url: string;
  types: string;
}

let datos_carrier: CarrierData;

// Verificar si el directorio tiene permisos de escritura
try {
  fs.accessSync(path.dirname(db_path), fs.constants.W_OK);
} catch (err) {
  console.error('El directorio no tiene permisos de escritura:', err);
}

const user_db = new sqlite3.Database(db_path, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
  if (err) {
    console.error('Error en la conexión:', err);
  } else {
    console.log('Conexión a la base de datos establecida');
  }
});

class AuthenticationController {
  async install(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> {
    try {
      const data = await InstallAppService.install(req.query.code as string);
      console.log(data);

      user_db.serialize(async () => {
        user_db.run(`CREATE TABLE IF NOT EXISTS users (
          user_id TEXT NOT NULL,
          access_token TEXT NOT NULL,
          token_type TEXT NOT NULL,
          scope TEXT NOT NULL,
          saldo INTEGER,
          activo BOOLEAN,
          direccion TEXT NOT NULL,
          email TEXT NOT NULL,
          logo TEXT NOT NULL,
          whatsapp TEXT,
          contacto_tienda TEXT,
          metodo_pago TEXT,
          cp_tienda TEXT,
          phone TEXT
        )`, (err) => {
          if (err) {
            console.error('Error en la creación de la tabla:', err);
            return next(err);
          } else {
            console.log('Tabla creada o ya existe');
          }
        });

        try {
          const tiendaResponse = await fetch(`https://api.tiendanube.com/v1/${data.user_id}/store`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authentication': `bearer ${data.access_token}`,
              'User-Agent': 'Flash Now Entrepreneurs (emm.matiasacevedosiciliano@gmail.com)'
            }
          });

          if (!tiendaResponse.ok) {
            throw new Error(`Error fetching store data: ${tiendaResponse.statusText}`);
          }

          data_tienda = await tiendaResponse.json();
          console.log(`ESTE ES EL OBJ DE LA LLAMADA DE LA TIENDA!! ${JSON.stringify(data_tienda)}`);
        } catch (fetchError) {
          console.error('Error fetching store data:', fetchError);
          return next(fetchError);
        }

        const insert = `INSERT INTO users (user_id, access_token,contacto_tienda, token_type, scope, saldo, activo, direccion, email, logo, whatsapp, metodo_pago, cp_tienda, phone) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        user_db.run(insert, [
          data.user_id,
          data.access_token,
          data_tienda.contacto_tienda, 
          data.token_type,
          data.scope,
          0,
          true, 
          data_tienda.address || 'No definido',
          data_tienda.email || 'No definido',
          data_tienda.logo || 'No definido',
          data_tienda.phone || 'No definido',
          data_tienda.metodo_pago || 'No definido',
          data_tienda.cp_tienda || 'No definido',
          data_tienda.whatsapp_phone_number || 'No definido'
        ], async (err) => {
          if (err) {
            console.error('Error insertando usuario:', err);
            return next(err);
          } else {
            console.log('Usuario dado de alta exitosamente');
            const headers = {
              'Content-Type': 'application/json',
              'Authentication': `bearer ${data.access_token}`,
              'User-Agent': 'Flash Now Entrepreneurs (emm.matiasacevedosiciliano@gmail.com)'
            };
            console.log(`token ${data.access_token}`);

            try {
              const carrierResponse = await fetch(`https://api.tiendanube.com/v1/${data.user_id}/shipping_carriers`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(carrier)
              });
              const res_json = await carrierResponse.json();
              console.log(res_json);

              if (!res_json.id || !res_json.callback_url) {
                throw new Error("La respuesta de la API no contiene los datos esperados.");
              }

              datos_carrier = res_json;

              user_db.serialize(() => {
                user_db.run(`CREATE TABLE IF NOT EXISTS carrier (
                  user_id TEXT NOT NULL,
                  call_back TEXT NOT NULL,
                  carrier_id NUMBER NOT NULL
                )`, (err) => err ? console.error(err) : console.log('Tabla de carrier activa'));

                user_db.run(`INSERT INTO carrier VALUES (?,?,?)`, [data.user_id, res_json.callback_url, res_json.id], (err) => {
                  if (err) {
                    console.error('Error insertando carrier:', err);
                  }
                });
              });
              console.log(`peticion a la api en el carrier option: https://api.tiendanube.com/v1/${data.user_id}/shipping_carriers/${res_json.id}/options`)
              const carrierOptResponse = await fetch(`https://api.tiendanube.com/v1/${data.user_id}/shipping_carriers/${res_json.id}/options`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(carrier_opt)
              });
              const carr_res = await carrierOptResponse.json();
              console.log(carr_res);

            } catch (fetchError) {
              console.error('Error en la petición a la API de Tiendanube:', fetchError);
              return next(fetchError);
            }
            return res.render(vista_path, {
              id: data.user_id,
              formaction: '/registro',
              title: 'Alta Usuarios',
              formTitle: 'Confirme sus datos de cuenta',
              direccion: data_tienda.address || 'No definido',
              whatsapp: data_tienda.whatsapp_phone_number || 'No definido',
              telefono:data_tienda.phone || 'No definido', 
              email:data_tienda.email || 'No definido',
            })
            //return res.sendFile('../../../vistas/registro.html')
            //return res.status(StatusCode.OK).json(data);
          }
        });
      });

    } catch (e) {
      return next(e);
    }
  }

  async login(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> {
    try {
      const data = AuthService.login(req.body);
      return res.status(StatusCode.OK).json(data);
    } catch (e) {
      return next(e);
    }
  }
}

export default new AuthenticationController();