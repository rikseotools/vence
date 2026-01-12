# Roadmap: Plataforma MoR con Pagos en Bitcoin

> **Nombre provisional:** BitPay MoR / CryptoPay / SatoshiSeller (por definir)
> **Concepto:** Merchant of Record que cobra en fiat y paga a vendedores en Bitcoin
> **Propuesta de valor:** "Vende online, cobra en Bitcoin. Sin Stripe, sin impuestos, sin complicaciones."

---

## Resumen Ejecutivo

### El Problema
Los creadores digitales que quieren cobrar en Bitcoin enfrentan:
1. Configurar pasarela de pagos (Stripe/PayPal)
2. Gestionar impuestos (IVA, retenciones, declaraciones)
3. Convertir fiat a Bitcoin manualmente
4. Gestionar volatilidad y timing de conversión

### La Solución
Plataforma "llave en mano" donde:
- El vendedor solo proporciona su wallet Bitcoin
- Nosotros somos el Merchant of Record (facturamos al cliente final)
- Cobramos 10% todo incluido (Stripe fees + nuestra comisión)
- Pagamos al vendedor en Bitcoin automáticamente

### Modelo de Negocio
```
Venta de 100€
├── Stripe fee: ~3€
├── Nuestra comisión: ~7€
└── Pago al vendedor: 90€ en BTC
```

---

## Fase 1: MVP (Mes 1-2)

### Objetivo
Validar el concepto con un producto mínimo funcional.

### Funcionalidades Core

#### 1.1 Onboarding de Vendedores
- [ ] Registro con email
- [ ] Verificación KYC básica (nombre, país, documento)
- [ ] Input de wallet Bitcoin (validación de formato)
- [ ] Aceptación de términos y condiciones

#### 1.2 Creación de Productos
- [ ] Dashboard simple para crear productos digitales
- [ ] Campos: nombre, descripción, precio (EUR/USD)
- [ ] Generación de link de pago único
- [ ] Página de checkout hosted (como Stripe Checkout)

#### 1.3 Procesamiento de Pagos
- [ ] Integración Stripe (nuestra cuenta como MoR)
- [ ] Checkout con tarjeta de crédito
- [ ] Webhook para confirmar pagos
- [ ] Registro en base de datos

#### 1.4 Payout en Bitcoin
- [ ] Integración con exchange (Kraken/Binance API)
- [ ] Compra automática de BTC al recibir pago
- [ ] Envío a wallet del vendedor
- [ ] Notificación por email con txid

#### 1.5 Dashboard Vendedor
- [ ] Ver ventas en tiempo real
- [ ] Historial de payouts con txid
- [ ] Balance pendiente de pago
- [ ] Configuración de wallet

### Stack Técnico MVP
```
Frontend:     Next.js 14+ (App Router)
Backend:      Next.js API Routes
Base datos:   Supabase (PostgreSQL)
Pagos:        Stripe Connect (Platform)
Exchange:     Kraken API (más regulado en EU)
Auth:         Supabase Auth
Hosting:      Vercel
```

### Entregables Fase 1
- [ ] Landing page explicativa
- [ ] Registro de vendedores
- [ ] Creación de 1 producto por vendedor
- [ ] Checkout funcional
- [ ] Payout manual en Bitcoin (semi-automático)

---

## Fase 2: Automatización (Mes 3-4)

### Objetivo
Automatizar completamente el flujo de pagos.

### Funcionalidades

#### 2.1 Payouts Automáticos
- [ ] Cron job para procesar payouts cada X horas
- [ ] Batching de pagos pequeños (mínimo 50€ para payout)
- [ ] Gestión de fees de red Bitcoin
- [ ] Retry automático en caso de fallo

#### 2.2 Múltiples Productos
- [ ] Catálogo de productos por vendedor
- [ ] Productos con variantes (tallas, opciones)
- [ ] Códigos de descuento
- [ ] Productos de suscripción (recurrente)

#### 2.3 Entrega Digital
- [ ] Upload de archivos digitales
- [ ] Links de descarga con expiración
- [ ] Entrega por email automática
- [ ] Integración con servicios externos (Teachable, etc.)

#### 2.4 Reporting
- [ ] Dashboard con métricas de ventas
- [ ] Exportar ventas a CSV
- [ ] Gráficos de tendencias
- [ ] Comparativa EUR vs BTC recibido

#### 2.5 Multi-moneda Crypto
- [ ] Opción de payout en USDT (stablecoin)
- [ ] Lightning Network para pagos pequeños
- [ ] Elección del vendedor: BTC, USDT, o mix

---

## Fase 3: Compliance & Escala (Mes 5-8)

### Objetivo
Preparar la plataforma para escalar legalmente.

### Legal & Compliance

#### 3.1 Estructura Legal
- [ ] Constitución de empresa (¿Estonia e-Residency? ¿Malta?)
- [ ] Licencia de servicios de pago (si aplica)
- [ ] Registro como exchange/crypto service
- [ ] Términos de servicio y privacidad

#### 3.2 KYC/AML
- [ ] Integración con proveedor KYC (Jumio, Onfido)
- [ ] Verificación de identidad automatizada
- [ ] Screening AML (Anti Money Laundering)
- [ ] Límites por nivel de verificación

#### 3.3 Fiscalidad
- [ ] Sistema de facturación automática
- [ ] Gestión de IVA por país (EU VAT)
- [ ] Reporting fiscal para vendedores
- [ ] Integración con asesoría fiscal

### Escalabilidad Técnica

#### 3.4 Infraestructura
- [ ] Migrar a infraestructura dedicada si necesario
- [ ] CDN para assets estáticos
- [ ] Rate limiting y protección DDoS
- [ ] Backups automatizados

#### 3.5 Seguridad
- [ ] Auditoría de seguridad externa
- [ ] Penetration testing
- [ ] 2FA obligatorio para vendedores
- [ ] Cold wallet para reservas de BTC

---

## Fase 4: Crecimiento (Mes 9-12)

### Objetivo
Adquirir usuarios y expandir funcionalidades.

### Marketing & Growth

#### 4.1 Adquisición
- [ ] Programa de afiliados (referidos)
- [ ] Content marketing (blog, YouTube)
- [ ] Partnerships con influencers crypto
- [ ] Presencia en comunidades (Twitter/X, Reddit)

#### 4.2 Retención
- [ ] Email marketing automatizado
- [ ] Onboarding guiado
- [ ] Soporte chat en vivo
- [ ] Comunidad de vendedores (Discord)

### Funcionalidades Avanzadas

#### 4.3 Storefront
- [ ] Tienda personalizable por vendedor
- [ ] Dominio personalizado
- [ ] Temas y customización
- [ ] SEO optimizado

#### 4.4 Integraciones
- [ ] API pública para desarrolladores
- [ ] Webhooks para eventos
- [ ] Zapier/Make integration
- [ ] WordPress plugin

#### 4.5 Productos Físicos (Opcional)
- [ ] Soporte para productos físicos
- [ ] Integración con fulfillment
- [ ] Cálculo de envío
- [ ] Tracking de pedidos

---

## Modelo de Precios

### Estructura Propuesta

| Plan | Comisión | Características |
|------|----------|-----------------|
| **Starter** | 10% | Todo incluido, payout en BTC |
| **Pro** | 8% | + Dominio propio, API access |
| **Enterprise** | 5% | + Cuenta dedicada, SLA |

### Comparativa con Competencia

| Plataforma | Comisión | Payout |
|------------|----------|--------|
| **Nosotros** | 10% all-in | Bitcoin |
| Lemon Squeezy | 5% + fees (~8%) | Fiat |
| Gumroad | 10% | Fiat |
| Paddle | 5% + fees (~8%) | Fiat |
| Payhip | 5% + fees | Fiat |

**Diferenciador:** Único MoR con payout nativo en Bitcoin.

---

## Riesgos y Mitigaciones

### Riesgo 1: Regulatorio
- **Problema:** Legislación crypto cambiante
- **Mitigación:** Jurisdicción crypto-friendly (Estonia, Malta, Suiza)
- **Mitigación:** Asesoría legal especializada desde el inicio

### Riesgo 2: Volatilidad BTC
- **Problema:** Precio BTC baja entre venta y payout
- **Mitigación:** Compra inmediata de BTC al recibir pago
- **Mitigación:** Opción de payout en USDT (stablecoin)

### Riesgo 3: Fraude
- **Problema:** Chargebacks, tarjetas robadas
- **Mitigación:** Stripe Radar para detección de fraude
- **Mitigación:** KYC obligatorio sobre cierto volumen
- **Mitigación:** Retención de payouts 7 días (periodo chargeback)

### Riesgo 4: Liquidez
- **Problema:** No tener suficiente BTC para payouts
- **Mitigación:** Reserva de liquidez en exchange
- **Mitigación:** Límites de payout diarios inicialmente

### Riesgo 5: Competencia
- **Problema:** Stripe/PayPal lanzan payout en crypto
- **Mitigación:** Moverse rápido, construir comunidad
- **Mitigación:** Nicho específico (creadores crypto-native)

---

## Métricas de Éxito

### MVP (Fase 1)
- [ ] 10 vendedores registrados
- [ ] 50 transacciones procesadas
- [ ] 0 incidentes de seguridad
- [ ] < 24h tiempo de payout

### Crecimiento (Fase 4)
- [ ] 1,000 vendedores activos
- [ ] 10,000 transacciones/mes
- [ ] GMV (Gross Merchandise Value) > 500k€/mes
- [ ] Revenue > 50k€/mes

---

## Presupuesto Estimado

### Desarrollo MVP (Fase 1-2)
| Concepto | Coste |
|----------|-------|
| Desarrollo (si externo) | 15,000-25,000€ |
| Infraestructura (6 meses) | 500€ |
| Dominio + Branding | 500€ |
| Legal inicial | 2,000€ |
| **Total MVP** | **~20,000-30,000€** |

### Operación Mensual (post-lanzamiento)
| Concepto | Coste/mes |
|----------|-----------|
| Hosting (Vercel Pro) | 20€ |
| Supabase Pro | 25€ |
| Exchange fees | Variable |
| Legal/Contable | 500€ |
| Marketing | 500-2,000€ |
| **Total mensual** | **~1,000-2,500€** |

---

## Próximos Pasos Inmediatos

### Esta Semana
1. [ ] Validar idea con potenciales usuarios (5-10 entrevistas)
2. [ ] Investigar requisitos legales en España/EU
3. [ ] Crear cuenta en Kraken/Binance con API
4. [ ] Reservar dominio

### Este Mes
1. [ ] Diseñar wireframes del MVP
2. [ ] Setup del proyecto (repo, CI/CD)
3. [ ] Implementar registro + KYC básico
4. [ ] Implementar checkout con Stripe

---

## Notas Adicionales

### Jurisdicciones Crypto-Friendly
- **Estonia:** e-Residency, licencias crypto claras
- **Malta:** "Blockchain Island", regulación avanzada
- **Portugal:** Fiscalidad favorable para crypto
- **Suiza (Zug):** "Crypto Valley", muy establecido
- **El Salvador:** Bitcoin legal tender, pero riesgoso

### Exchanges con Buena API
- **Kraken:** Muy regulado en EU, buena API
- **Bitstamp:** Europeo, licenciado en Luxemburgo
- **Coinbase Pro:** Buena API, pero más restrictivo

### Recursos Útiles
- [Stripe Atlas](https://stripe.com/atlas) - Crear empresa en US
- [Lemon Squeezy Docs](https://docs.lemonsqueezy.com/) - Referencia MoR
- [Kraken API Docs](https://docs.kraken.com/rest/)
- [EU Crypto Regulations (MiCA)](https://www.europarl.europa.eu/news/en/press-room/20220309IPR25162/cryptocurrencies-in-the-eu-new-rules-to-boost-benefits-and-curb-threats)

---

*Documento creado: 11 enero 2026*
*Última actualización: 11 enero 2026*
