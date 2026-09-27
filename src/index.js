const express = require("express");
const path = require("node:path");
const expressLayouts = require("express-ejs-layouts");
const morgan = require("morgan");

const PORT = 3000;

// Listas de valores permitidos 
const salasPermitidas = ["Sala Norte", "Sala Sur", "Sala Multimedia"];
const turnosPermitidos = ["Mañana", "Tarde", "Noche"];

// Datos iniciales 
const reservas = [
   {
      id: 1,
      estudiante: "Ana García",
      email: "ana.garcia@example.com",
      sala: "Sala Norte",
      fecha: "2026-04-10",
      turno: "Mañana",
      personas: 3
   },
   {
      id: 2,
      estudiante: "Carlos Gómez",
      email: "carlos.gomez@example.com",
      sala: "Sala Sur",
      fecha: "2026-04-10",
      turno: "Tarde",
      personas: 2
   },
   {
      id: 3,
      estudiante: "Lucía Fernández",
      email: "lucia.f@example.com",
      sala: "Sala Multimedia",
      fecha: "2026-04-11",
      turno: "Noche",
      personas: 5
   },
   {
      id: 4,
      estudiante: "Martín Rodríguez",
      email: "martin.r@example.com",
      sala: "Sala Norte",
      fecha: "2026-04-12",
      turno: "Tarde",
      personas: 4
   }
];

let numeroSolicitudes = 0;

// Middleware Identificador 
function identificarSolicitud(req, res, next) {
   numeroSolicitudes += 1;
   res.locals.solicitudId = `BIB-${String(numeroSolicitudes).padStart(4, "0")}`;
   next();
}

// Middleware Medición 
function medirDuracion(req, res, next) {
   const inicio = process.hrtime.bigint();
   res.on("finish", () => {
      const fin = process.hrtime.bigint();
      const milisegundos = Number(fin - inicio) / 1_000_000;
      console.log(
         `[${res.locals.solicitudId}] ${req.method} ${req.originalUrl} ` +
         `${res.statusCode} ${milisegundos.toFixed(2)} ms`
      );
   });
   next();
}

// Middleware de router 
function prepararAreaReservas(req, res, next) {
   res.locals.seccion = "Reservas de salas";
   next();
}

// Middleware de validación del formulario de reservas
function validarReserva(req, res, next) {
   const estudiante = String(req.body.estudiante ?? "").trim();
   const email = String(req.body.email ?? "").trim();
   const sala = String(req.body.sala ?? "").trim();
   const fecha = String(req.body.fecha ?? "").trim();
   const turno = String(req.body.turno ?? "").trim();
   const personas = Number(req.body.personas);

   //Campos obligatorios
   if (!estudiante || !email || !sala || !fecha || !turno) {
      return res.status(400).render("reservas/nueva", {
         titulo: "Nueva reserva",
         error: "Todos los campos son obligatorios.",
         valores: req.body,
         salasPermitidas,
         turnosPermitidos
      });
   }

   //Email con validación 
   if (!email.includes("@")) {
      return res.status(400).render("reservas/nueva", {
         titulo: "Nueva reserva",
         error: "El correo electrónico debe ser válido y contener '@'.",
         valores: req.body,
         salasPermitidas,
         turnosPermitidos
      });
   }

   // Sala verificadda
   if (!salasPermitidas.includes(sala)) {
      return res.status(400).render("reservas/nueva", {
         titulo: "Nueva reserva",
         error: "La sala seleccionada no es válida.",
         valores: req.body,
         salasPermitidas,
         turnosPermitidos
      });
   }

   //Turno verificado
   if (!turnosPermitidos.includes(turno)) {
      return res.status(400).render("reservas/nueva", {
         titulo: "Nueva reserva",
         error: "El turno seleccionado no es válido.",
         valores: req.body,
         salasPermitidas,
         turnosPermitidos
      });
   }

   // 5. Cantidad de personas: entre 1 y 6
   if (!Number.isInteger(personas) || personas < 1 || personas > 6) {
      return res.status(400).render("reservas/nueva", {
         titulo: "Nueva reserva",
         error: "La cantidad de personas debe ser un número entero entre 1 y 6.",
         valores: req.body,
         salasPermitidas,
         turnosPermitidos
      });
   }

   // Preparación del objeto validado
   req.reservaValidada = { estudiante, email, sala, fecha, turno, personas };
   next();
}

function main() {
   const app = express();

   // Handler final del POST
   function crearReserva(req, res) {
      const ultimoId = reservas.reduce((mayorId, r) => Math.max(mayorId, r.id), 0);
      reservas.push({ id: ultimoId + 1, ...req.reservaValidada });
      res.redirect("/reservas");
   }

   // Configuración de motor de vistas
   app.set("view engine", "ejs");
   app.set("views", path.join(__dirname, "..", "views"));
   app.set("layout", "layouts/main");

   // Pipeline de Middlewares Globales 
   app.use(morgan("dev"));
   app.use(identificarSolicitud);
   app.use(medirDuracion);
   app.use(expressLayouts);
   app.use(express.static(path.join(__dirname, "..", "public")));
   app.use(express.urlencoded({ extended: false }));
   app.use(express.json());

   // Ruta principal
   app.get("/", (req, res) => {
      res.render("inicio", { titulo: "Inicio - Sistema de Reservas" });
   });

   // Ruta /estado 
   app.get("/estado", (req, res) => {
      res.json({
         servicio: "activo",
         reservas: reservas.length,
         solicitudId: res.locals.solicitudId
      });
   });

   // Router de Reservas 
   const reservasRouter = express.Router();

   reservasRouter.use(prepararAreaReservas);

   // GET /reservas
   reservasRouter.get("/", (req, res) => {
      res.render("reservas/lista", {
         titulo: "Listado de reservas",
         reservas
      });
   });

   // GET /reservas/nueva 
   reservasRouter.get("/nueva", (req, res) => {
      res.render("reservas/nueva", {
         titulo: "Nueva reserva",
         error: null,
         valores: {},
         salasPermitidas,
         turnosPermitidos
      });
   });

   // GET /reservas/:id
   reservasRouter.get("/:id", (req, res) => {
      const id = Number(req.params.id);
      const reserva = reservas.find((elemento) => elemento.id === id);

      if (!reserva) {
         return res.status(404).render("no-encontrado", {
            titulo: "Reserva no encontrada",
            mensaje: "No existe una reserva con ese identificador."
         });
      }

      res.render("reservas/detalle", {
         titulo: `Detalle de reserva #${reserva.id}`,
         reserva
      });
   });

   // POST /reservas 
   reservasRouter.post("/", validarReserva, crearReserva);

   // Enlace del router con /reservas
   app.use("/reservas", reservasRouter);

   // Middleware final
   app.use((req, res) => {
      res.status(404).render("no-encontrado", {
         titulo: "Página no encontrada",
         mensaje: "La dirección solicitada no existe."
      });
   });

   app.listen(PORT, () => {
      console.log(`Aplicación disponible en http://localhost:${PORT}`);
   });
}

main();