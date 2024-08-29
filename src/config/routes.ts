import { response, Router } from "express";
import passport, { use } from "passport";
import path, { resolve } from "path";
import { AuthenticationController } from "@features/auth";
import { ProductController } from "@features/product";
import  sqlite3 from "sqlite3";
import { error } from "console";
import csv from 'csv-parser'
import fs, { access } from 'fs'
import { json } from "stream/consumers";
import { arrayBuffer } from "node:stream/consumers";
import { rejects } from "assert";
import { promises } from "dns";
let saldo : any = 0
let valores : Array<number> = []
let date :any = new Date()
let mañana =  date.setDate(date.getDate() + 1)
let pasado_mañana = date.setDate(date.getDate() + 2)
interface rows {
  [x: string]: any;
  user_id: Text,
  access_token: Text,
  metodo_pago: Text,
  direccion: Text,
  contacto_tienda: string,
  whatsapp: Text
}
let data: rows
let row: rows
let db_precios = path.join(__dirname, '../features/auth/precios.db' )
let db_path = path.join(__dirname, '../features/auth/users.db' )

const user_db = new sqlite3.Database(db_path, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
  if (err) {
    console.error('Error en la conexión:', err);
  } else {
    console.log('Conexión a la base de datos establecida');
  }
});

const routes = Router();
routes.post("/registro", (req, res) => {
console.log(req.body)
let direccion = req.body.direccion
let contacto_tienda = req.body.contacto_tienda
let user_id = req.body.id
let email = req.body.email
let telefono = req.body.telefono
let whatsapp = req.body.whatsapp
user_db.run('UPDATE users set direccion = ?, contacto_tienda = ?, email = ?, whatsapp = ?, phone = ? WHERE user_id = ?', [direccion, contacto_tienda, email, whatsapp, telefono, user_id], (err) => console.error(err))
res.send('gracias')
//res.render('usuario')
})
routes.get('/modif',(req, res) => {
user_db.serialize( () => {
  //user_db.run('UPDATE users set saldo = 0')
  //user_db.run('delete from pedidos')
  //user_db.run('drop table pedidos')
  user_db.run(
    `CREATE TABLE IF NOT EXISTS pedidos (
  fecha_retiro TEXT,
  id_tienda NUMBER,
  contacto_tienda TEXT,
  direccion_tienda TEXT,
  telefono_tienda TEXT,
  fecha_entrega TEXT,
  precio_envio TEXT,
  nombre_cliente TEXT,
  direccion_cliente TEXT,
  telefono_cliente TEXT,
  observaciones TEXT, 
  metodo_pago TEXT,
  seguimiento TEXT
  )`)
})
res.send('cambio realizado')
})

//webhooks obligatorios
routes.post("/hook", (req, res) => {
  let hook_json = path.join(__dirname, "hook.json")
  console.log(hook_json)
  let js = JSON.parse(fs.readFileSync(hook_json, 'utf-8'))
  fs.writeFileSync(hook_json, js.hooks.push(req.body))
  res.statusCode = 200
  res.end('proceso con exito')
})

routes.post("/hook_stores", (req, res) => {
  let hook_json = path.join(__dirname, "hook.json");
  console.log(hook_json);

  // Leer el contenido del archivo
  let data = fs.readFileSync(hook_json, 'utf-8');
  let js = JSON.parse(data);

  // Agregar el nuevo webhook
  js.hooks.push(req.body);

  // Escribir el contenido actualizado de vuelta al archivo
  fs.writeFileSync(hook_json, JSON.stringify(js, null, 2));

  res.status(200).send('Proceso con éxito');
})

//ruta para modificar los estados de envíos desde GUI
routes.get('/status_client', (req, res) =>{
let estados = ["dispatched", "received_by_post_office", "in_transit", "out_for_delivery", "delivery_attempt_failed", "delayed", "ready_for_pickup", "delivered", "returned_to_sender", "lost", "failure"]

})

//ruta para adminitracion
routes.get("/admin", (req, res)=>{

})

routes.post("/reservas", (req, res) =>{
//obtener la info de cada envío y de la tienda
//agregarlo a la base de datos
//enviar el numero de seguimiento
console.log(req.query)
let ids : any = req.query.id
console.log(typeof(ids))
let store_data : any
//buscamos la info de la tienda
user_db.serialize(() => {
user_db.get('user_id, access_token, contacto_tienda, direccion, whatsapp, saldo, metodo_pago FROM users WHERE user_id = ?', [req.query.store], (error, row : any) =>{
  //obtenemos los datos de la tienda
  store_data = {
    user_id: row.user_id,
    access_token: row.access_token,
    contacto_tienda: row.contacto_tienda,
    direccion: row.direccion,
    whatsapp: row.whatsapp,
    saldo: Number(row.saldo),
    metodo_pago: row.metodo_pago
  }
  console.log(store_data)

})})
//Buscamos la info de cada pedido
ids.forEach((e : any) => {
  fetch(`https://api.tiendanube.com/v1/${req.query.store}/orders/${e}`, {
    headers: {
      'Content-Type': 'application/json',
      'Authentication': `bearer ${store_data.access_token}`,
      'User-Agent':
        'Flash Now Entrepreneurs (emm.matiasacevedosiciliano@gmail.com)',
    }
  }).then(responce => responce.json()).then(data => {
    //agregamos los datos de los envios a la tabla de pedidos
    user_db.serialize(() => {
      user_db.run(
        `CREATE TABLE IF NOT EXISTS pedidos (
      fecha_retiro TEXT,
      id_tienda NUMBER,
      contacto_tienda TEXT,
      direccion_tienda TEXT,
      telefono_tienda TEXT,
      fecha_entrega TEXT,
      precio_envio TEXT,
      nombre_cliente TEXT,
      direccion_cliente TEXT,
      telefono_cliente TEXT,
      observaciones TEXT, 
      metodo_pago TEXT,
      seguimiento TEXT
      )`)
      user_db.run(
            'INSERT INTO pedidos (fecha_retiro, id_tienda, contacto_tienda, direccion_tienda, telefono_tienda, fecha_entrega, precio_envio, nombre_cliente, direccion_cliente, telefono_cliente, observaciones, metodo_pago, seguimiento) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)', [
              mañana,
              store_data.user_id,
              store_data.contacto_tienda,
              store_data.direccion,
              store_data.whatsapp,
              pasado_mañana,
              data.shipping_cost_owner,
              data.contact_name,
              `${data.shipping_address.address} ${data.shipping_address.number}, ${data.shipping_address.floor} ${data.shipping_address.locality}`,
              data.contact_phone,
              data.customer.note,
              store_data.metodo_pago,
              e])
    })
    //enviamos la info del numero de seguimiento por cada pedido
    fetch(`https://api.tiendanube.com/v1/${req.query.store}/orders/${e}/fulfill`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authentication': `bearer ${store_data.access_token}`,
        'User-Agent':
          'Flash Now Entrepreneurs (emm.matiasacevedosiciliano@gmail.com)',
      },
      body: JSON.stringify({
        shipping_tracking_number: `${e}`,
        shipping_tracking_url: "https://vmpk47rv-8000.brs.devtunnels.ms/seguimiento",
        notify_customer: true
      })
    })
    //luego de la respuiesta a cada pedido
  })
//termina el forEach
})
//termina la serializacion
})




routes.post("/costos", (req, res) => {
  let req_body = req.body;
  const tomorrow = new Date(new Date().getTime() + (24 * 60 * 60 * 1000))
  const pasado_mañana2 = new Date(new Date().getTime() + ((24 * 60 * 60 * 1000) * 3))
  function fecha(t : Date){
  const year = t.getFullYear()
  const month = String(t.getMonth() + 1).padStart(2, '0')
  const day = String(t.getDate()).padStart(2, '0')
  const hour = String(t.getHours()).padStart(2, '0')
  const minutes = String(t.getMinutes()).padStart(2, '0')
  const seconds = String(t.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day}T${hour}:${minutes}:${seconds}-0300`
}
    
  let volmaxmoto = 4000;
  let foundOrigin = false;
  let foundDestination = false;
  let costo_origen = 0;
  let cordon_origen : any;
  let cordon_destino: any;
  let zona_destino : any;
  let zona_origen : any;
  let costo_destino = 0;
  let cp_origen = req.body.origin.postal_code;
  let cp_destino = req.body.destination.postal_code;
  let items = req.body.items
  let aux = 0
  let vol_total = calc(items)
  function calc(items : any){
    items.forEach((element: { dimensions: { width: number; height: number; depth: number; }; }) => {
      aux = aux + (element.dimensions.width * element.dimensions.height * element.dimensions.depth)
    });
    return aux
  }
  console.log(vol_total)
  let price : any
  

  const compare = () => {
    return new Promise<void>((resolve, reject) => {
      fs.createReadStream(path.join(__dirname,'cps.csv')).pipe(csv()).on('data', row => {
        if(Number(cp_origen) <= 1400 && Number(cp_origen) >= 1000 && foundOrigin == false){
          zona_origen = 'CABA'
          cordon_origen = 'CABA'
          vol_total > volmaxmoto ? costo_origen = 3300 : costo_origen = 3650
          foundOrigin = true
        }
        if(Number(cp_destino) <= 1400 && Number(cp_destino) >= 1000 && foundDestination == false){
          zona_destino = 'CABA'
          cordon_destino = 'CABA'
          vol_total > volmaxmoto ? costo_destino = 3300 : costo_destino = 3650
          foundDestination = true
        }
        if(cp_origen == row.cp && foundOrigin == false){
          zona_origen = row.zona
          cordon_origen = row.cordon
          vol_total > volmaxmoto ? costo_origen = row.auto : costo_origen = row.moto
          foundOrigin = true
        }if(cp_destino == row.cp && foundDestination == false){
          zona_destino = row.zona
          cordon_destino = row.cordon
          vol_total > volmaxmoto ? costo_destino = row.auto : costo_destino = row.moto
          foundDestination = true
        }
        if(foundDestination == true && foundOrigin == true){
          costo_destino >= costo_origen ? price = costo_destino : price = costo_origen
          if(zona_destino != 'CABA' && zona_origen != 'CABA' && zona_destino != zona_origen){
            cordon_origen == 'cordon 1' ? price = Number(price) + 500 : price
            cordon_origen == 'cordon 2' ? price = Number(price) + 1000 : price
            cordon_origen == 'cordon 3' ? price = Number(price) + 2500 : price
          }
          resolve()
          return false
        }
      }).on('end',() => {
        if (!foundOrigin || !foundDestination) {
          reject(new Error('Códigos postais no encontrados'));
        }
      })
    })
  }
  compare().then(() => {
    let obj = {
      rates: [
          {
              name: "FLASH NOW ENVIOS Express",
              code: "express",
              price: Number(price),
              price_merchant: Number(price),
              currency: "ARS",
              type: "ship",
              min_delivery_date: fecha(tomorrow),
              max_delivery_date: fecha(pasado_mañana2),
              phone_required: true,
              reference: "ref123"
          }
      ]
  }
  console.log(obj)
  res.json(obj)
  }).catch((error) => {
    console.error(error)
    res.statusMessage = 'No hay CPA encontrado'
    res.sendStatus(404)
  })
  
});



routes.get("/auth/install", AuthenticationController.install);
routes.post(
  "/products",
  passport.authenticate("jwt", { session: false }),
  ProductController.create
);

routes.get(
  "/products/total",
  passport.authenticate("jwt", { session: false }),
  ProductController.getTotal
);
routes.get(
  "/products",
  passport.authenticate("jwt", { session: false }),
  ProductController.getAll
);
routes.delete(
  "/products/:id",
  passport.authenticate("jwt", { session: false }),
  ProductController.delete
);

export default routes;
