# 01 — Product Vision

## Purpose

Taavi Configurator is a visual product customization tool for Taavi, an existing handmade ceramics store that operates on Nuvemshop. It lets a customer compose a personalized ceramic piece, see an accurate real-time preview, and export an image of the result.

It is an internal business tool with a customer-facing interface. It is **not** a commercial SaaS product.

## Target users

- **Customers** of the store who want a personalized ceramic piece (primarily on mobile devices).
- **Store staff**, who use the exported image as an unambiguous record of what the customer chose.

## Main user problem

Customers cannot currently see what their personalized piece will look like before ordering. Choices about the model and text are communicated informally, which causes uncertainty for the customer and rework for the store.

## Expected benefits

- Customers see their composition before committing.
- The store receives a consistent visual representation of each request.
- Fewer misunderstandings between customer intent and the produced piece.

## MVP scope

| Option                    | Required                                                     |
| ------------------------- | ------------------------------------------------------------ |
| Model (Modelo)            | Yes — Placa cerâmica, Quadro, Bandeja ondulada M (two sizes) |
| Frame                     | No separate choice: the Quadro includes its frame (D-046)    |
| Piece color (Cor da peça) | Not a choice: fixed per model (Bege), shown read-only        |
| Custom text (Texto)       | Yes                                                          |
| Real-time preview         | —                                                            |
| Image export              | —                                                            |

The text has a font family, up to two lettering colors, alignment, and position (M4.1b). Images are curated by Taavi only; customers never upload images (FR-09).

Details and acceptance criteria: [02-requirements.md](02-requirements.md).

## Out of scope

Customer image uploads (file picker, drag-and-drop, image URLs, image storage or upload APIs), Nuvemshop integration, shopping cart, checkout, order management, payments, customer accounts, authentication, database, backend API, cloud storage, inventory, dynamic pricing, AI-generated previews, 3D rendering, admin dashboard, analytics, multi-tenancy, and any commercial SaaS functionality.

The long-term goal is to integrate with the existing store **without rebuilding its e-commerce infrastructure**. Future integration must not drive complexity into the current architecture.

## Product principles

- Simplicity over unnecessary complexity.
- Accurate representation of the configured product.
- Mobile-first usability.
- Minimalist, clean visual design.
- Incremental delivery.
- Maintainable, testable code.
- No unnecessary backend services.
- No premature optimization.
- **No invented product information.**
