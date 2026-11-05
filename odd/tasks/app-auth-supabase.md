# Feature: app-auth-supabase

Objective: Crear una app con login de usuarios (Supabase Auth), roles (admin/cliente), CRUD de productos (solo admin), compra de productos y reseñas (solo cliente). Frontend React conectado a Supabase.

Branch: main (init)
Delivery strategy: ask-on-risk
Test runner: TBD (se definirá al inicializar frontend/backend)

## Specs

S1: "investigar conexion con superbase, que seria la seccion de authentication" - Investigar y documentar cómo conectar/auth con Supabase (Auth, URL/anon key, sesión).
S2: "conectar con el front de react" - Inicializar proyecto React (Vite o CRA, pero preferir Vite) y conectar SDK de Supabase.
S3: "permitir la creacion de usuarios con nombre y contrasena" - Registro/login con email+password (o username+password). Guardar/mostrar perfil del usuario.
S4: "estos deben ingresar a la app y mostrar su perfil" - Flujo post-login: redirigir a app, mostrar datos de perfil (nombre/rol).
S5: "debe de ver dos tipos, admin y cliente" - Sistema de roles. Crear/definir rol (tabla profiles con role: 'admin' | 'cliente', o user_metadata/claims).
S6: "admin crea productos y pone precio" - Panel/admin para crear productos (nombre, precio, descripción, imagen opcional). Solo admin.
S7: "y cliente compra productos, se logea, deja resenas" - Cliente autenticado puede comprar (carrito/orden simple) y dejar reseñas por producto.
S8: "crear nuevo proyecto de superbase, nueva conexion" - Crear proyecto en Supabase, obtener URL/anon key, configurar .env. Documentar pasos.
S9: "dame los paso para hacerlo y emaneja todo con ODD antes que ser SDD" - Seguir ODD, generar pasos accionables.
S10: "en la seccion de la tienda no tiene como decirlo la categoria de seleccion para comprar" - Los productos tienen categoría y la tienda permite filtrar por categoría antes de comprar.

## Tasks

T1 | S1,S8 | route: inline | status: done | commit: -
T2 | S2 | route: inline | status: done | commit: -
T3 | S3,S4 | route: inline | status: done | commit: -
T4 | S5 | route: inline | status: done | commit: -
T5 | S6 | route: inline | status: done | commit: -
T6 | S7 | route: inline | status: done | commit: -
T7 | S9 | route: inline | status: done | commit: - (documentación/plan final)
T8 | S10 | route: inline | status: blocked (falta correr SQL de migración) | commit: -

## Log

L1: "vamos a ahcer un proyecto con login de usuarios
investigar coneccion con superbase, que seria la seccion de authentication
conectar con el front de react
y permitir la creacion de usuarios con nombre y contrasena
estos deben ingresar a la app y mostrar su perfil
9:15 p.m.
debe de ver dos tipos, admin ]y cliente
admin crea productos y pone precio
y cliente compra productos, se logea, deja resenas
crear nuevo proyecto de superbase, nueva conexion 
dame los paso para hacerlo y emaneja todo con ODD antes que ser SDD" (2026-10-27)

L2: Feature document created. Starting T1: investigar Supabase Auth y pasos para nuevo proyecto/conexión.
