import { response, Router } from "express";
import passport, { use } from "passport";
import path from "path";
import { AuthenticationController } from "@features/auth";
import { ProductController } from "@features/product";
import  sqlite3 from "sqlite3";
import { error } from "console";
import csv from 'csv-parser'
import fs from 'fs'

interface rows {
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
routes.get('/',(req, res) => {
res.send('hola')
})

routes.get('/', (req, res) => {
res.send('hola')
})


routes.get("/reservas", (req, res) => {
  console.log(req.query)
  let ids = Array.isArray(req.query.id) ? req.query.id : [req.query.id]
  console.log(ids)
  let pedidos : any = []
  let valores : any = []
  let calc = () => {
    return new Promise<void> ( (resolve, reject) => { user_db.get('SELECT user_id, access_token, contacto_tienda, direccion, whatsapp, saldo, metodo_pago FROM users WHERE user_id = ?', [req.query.store], async (error: any, row: any)=> {
    if(!error){
      console.log(row)
      const data_user = {
        saldo: Number(row.saldo),
        metodo_pago: row.metodo_pago,
        user_id: row.user_id,
        contacto_tienda: row.contacto_tienda,
        access_token: row.access_token,
        direccion: row.direccion,
        whatsapp: row.whatsapp
      }
       ids.forEach(async element => {
        await fetch(`https://api.tiendanube.com/v1/${data_user.user_id}/orders/${element}`,{
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authentication': `bearer ${data_user.access_token}`,
            'User-Agent': 'Flash Now Entrepreneurs (emm.matiasacevedosiciliano@gmail.com)'
          }
      }).then(j => j.json()).then(order => {
        pedidos.push({
          vendedor: data_user.user_id,
          metodo_pago: data_user.metodo_pago,
          direccion_retiro: data_user.direccion,
          telefono_retiro: data_user.whatsapp,
          id: order.id,
          contact_email: order.contact_email,
          nombre_cliente: order.contact_name,
          telefono_cliente: order.contact_phone,
          costo_envio: order.shipping_cost_owner,
          direccion: `${order.shipping_address.address} ${order.shipping_address.floor != '0' ? order.shipping_address.floor : ''} ${order.shipping_address.number}, ${order.shipping_address.locality}, `
        })
        valores.push(order.shipping_cost_owner)
      })
      resolve()
    })
    }else{
      res.statusMessage = 'Error'
      res.sendStatus(500)
      res.end('Ha habido un error en la carga, no se ha procesado ninguna orden')
    }
  
  })})}
  calc().then(async () =>{
    try{
      await fetch('https://script.google.com/macros/s/AKfycbzXuFtx-xvwzAFRrJAjus-gPQlRC5wWZT28HJEq_P2ZCbbkRKGAayE_AkVDdhPK_-zL/exec', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ordenes : pedidos})
      })
      console.log(valores)
      console.log('///////////////////////////////////////////////////////////')
      console.log(JSON.stringify({ ordenes: pedidos}))
      res.end('Pedidos cargados correctamente')
    }catch(error){
      console.log(error)
    }
  }
  ).catch(err => res.sendStatus(500))


})

routes.post("/costos", (req, res) => {
  let req_body = req.body;
  const tomorrow = new Date(new Date().getTime() + (24 * 60 * 60 * 1000))
  const now = new Date()
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
              min_delivery_date: fecha(now),
              max_delivery_date: fecha(tomorrow),
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
