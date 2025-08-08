import { join } from "path";
import { writeFileSync, unlinkSync, existsSync } from "fs";
import {
  createBot,
  createProvider,
  createFlow,
  addKeyword,
  utils,
  MemoryDB,
} from "@builderbot/bot";
import { MysqlAdapter as Database } from "@builderbot/database-mysql";
import { BaileysProvider as Provider } from "@builderbot/provider-baileys";

const PORT = process.env.PORT ?? 3003;

const discordFlow = addKeyword("doc").addAnswer(
  [
    "You can see the documentation here",
    "📄 https://builderbot.app/docs \n",
    "Do you want to continue? *yes*",
  ].join("\n"),
  { capture: true },
  async (ctx, { gotoFlow, flowDynamic }) => {
    if (ctx.body.toLocaleLowerCase().includes("yes")) {
      return gotoFlow(registerFlow);
    }
    await flowDynamic("Thanks!");
    return;
  }
);

const welcomeFlow = addKeyword(["hi", "hello", "hola"])
  .addAnswer(`Bienvenido al chatBot 🤖  de PSA-SYSTEMS `)
  .addAnswer(
    [
      "Este fue creado con el proposito de brindar una solucion a los problemas de los clientes de PSA-SYSTEMS",
      "",
    ].join("\n"),
    { delay: 800, capture: true },
    async (ctx, { fallBack }) => {
      if (!ctx.body.toLocaleLowerCase().includes("doc")) {
        return fallBack("You should type *doc*");
      }
      return;
    },
    [discordFlow]
  );
  const responseFlowByChat = addKeyword([
    "ok",
    "OK",
    "oc",
    "OC",
    "si",
    "Si",
    "SI",
    "esta bien",
    "Esta bien",
    "ESTA BIEN",
    "muy bien",
    "Muy Bien",
    "Muy bien",
    "muy Bien",
    "MUY BIEN",
  ])
  .addAnswer(`logo`, {
    media: join(process.cwd(), "assets", "psa.png"),
  })
    .addAnswer(`Bienvenido al chatBot 🤖  de PSA-SYSTEMS `)
    .addAnswer(
      [
        "El usuario no se dará cuenta del mensaje que acabas de mandar porque es un chatbot del sistema Punto de Venta de PSA-SYSTEMS. Contactate directamente con el usuario.",
        "",
      ]
    );
const registerFlow = addKeyword(utils.setEvent("REGISTER_FLOW"))
  .addAnswer(
    `What is your name?`,
    { capture: true },
    async (ctx, { state }) => {
      await state.update({ name: ctx.body });
    }
  )
  .addAnswer("What is your age?", { capture: true }, async (ctx, { state }) => {
    await state.update({ age: ctx.body });
  })
  .addAction(async (_, { flowDynamic, state }) => {
    await flowDynamic(
      `${state.get(
        "name"
      )}, thanks for your information!: Your age: ${state.get("age")}`
    );
  });

const fullSamplesFlow = addKeyword(["samples", utils.setEvent("SAMPLES")])
  .addAnswer(`💪 I'll send you a lot files...`)
  .addAnswer(`Send image from Local`, {
    media: join(process.cwd(), "assets", "sample.png"),
  })
  .addAnswer(`Send video from URL`, {
    media:
      "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExYTJ0ZGdjd2syeXAwMjQ4aWdkcW04OWlqcXI3Ynh1ODkwZ25zZWZ1dCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/LCohAb657pSdHv0Q5h/giphy.mp4",
  })
  .addAnswer(`Send audio from URL`, {
    media: "https://cdn.freesound.org/previews/728/728142_11861866-lq.mp3",
  })
  .addAnswer(`Send file from URL`, {
    media:
      "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
  });

const main = async () => {
  const adapterFlow = createFlow([welcomeFlow, registerFlow, fullSamplesFlow,responseFlowByChat]);

  const adapterProvider = createProvider(Provider);
  const adapterDB = new Database({
    /**
     *     host: process.env.MYSQL_DB_HOST,
        user: process.env.MYSQL_DB_USER,
        database: process.env.MYSQL_DB_NAME,
        password: process.env.MYSQL_DB_PASSWORD,
     */
    host: "107.180.16.127",
    port: 3306,
    user: "carlos",
    database: "DB_Bot_Psa",
    password: "pelicula1",
  });

  const { handleCtx, httpServer } = await createBot({
    flow: adapterFlow,
    provider: adapterProvider,
    database: adapterDB,
  });

  adapterProvider.server.post(
    "/v1/messages",
    handleCtx(async (bot, req, res) => {
      const { number, message, pdf, xml } = req.body;

      // Si el mensaje es null o vacío, usar un mensaje predeterminado
      const finalMessage =
        message && message.trim() !== ""
          ? message
          : "Adjunto el PDF Y XML de la factura para que puedas verla";

      ///Enviamos el mensaje al contacto
      await bot.sendMessage(number, finalMessage, {
        media: null,
      });

      try {
        // Si hay un PDF, enviarlo
        if (pdf) {
          // Generar nombre único para el archivo temporal
          const timestamp = Date.now();
          const pdfFileName = `factura_pdf_${timestamp}.pdf`;
          const pdfFilePath = join(process.cwd(), pdfFileName);

          try {
            // Función para validar si es base64 válido
            const isValidBase64 = (str) => {
              try {
                return Buffer.from(str, "base64").toString("base64") === str;
              } catch (err) {
                return false;
              }
            };

            // Verificar si el contenido es base64 válido
            if (isValidBase64(pdf)) {
              // Decodificar el base64 y guardar como archivo temporal
              const pdfBuffer = Buffer.from(pdf, "base64");
              writeFileSync(pdfFilePath, pdfBuffer);

              // Enviar el archivo PDF
              await bot.sendMessage(number, "", {
                media: pdfFilePath,
              });

              // Borrar el archivo temporal después del envío
              if (existsSync(pdfFilePath)) {
                unlinkSync(pdfFilePath);
              }
            } else {
              // Si no es base64, asumir que es una ruta de archivo
              await bot.sendMessage(number, "", { media: pdf });
            }
          } catch (pdfError) {
            console.error("Error procesando PDF:", pdfError);
            // Limpiar archivo si existe en caso de error
            if (existsSync(pdfFilePath)) {
              unlinkSync(pdfFilePath);
            }
            throw pdfError;
          }
        }

        // Si hay un XML en base64, procesarlo
        if (xml) {
          // Generar nombre único para el archivo temporal
          const timestamp = Date.now();
          const xmlFileName = `factura_xml_${timestamp}.xml`;
          const xmlFilePath = join(process.cwd(), xmlFileName);

          try {
            // Validar y procesar el contenido XML
            let xmlContent;

            // Función para validar si es base64 válido
            const isValidBase64 = (str) => {
              try {
                return Buffer.from(str, "base64").toString("base64") === str;
              } catch (err) {
                return false;
              }
            };

            // Verificar si el contenido es base64 válido
            if (isValidBase64(xml)) {
              try {
                const decodedBuffer = Buffer.from(xml, "base64");
                xmlContent = decodedBuffer.toString("utf8");

                // Validar que el contenido decodificado sea XML válido
                if (
                  !xmlContent.trim().startsWith("<?xml") &&
                  !xmlContent.trim().startsWith("<")
                ) {
                  throw new Error(
                    "El contenido decodificado no parece ser XML válido"
                  );
                }
              } catch (error) {
                console.error("Error decodificando base64:", error);
                throw new Error(
                  "El contenido base64 no se pudo decodificar correctamente"
                );
              }
            } else {
              // Si no es base64, asumir que es texto plano XML
              xmlContent = xml;

              // Validar que sea XML válido
              if (
                !xmlContent.trim().startsWith("<?xml") &&
                !xmlContent.trim().startsWith("<")
              ) {
                throw new Error("El contenido no parece ser XML válido");
              }
            }

            // Guardar el archivo con encoding UTF-8 sin BOM
            writeFileSync(xmlFilePath, xmlContent, {
              encoding: "utf8",
              flag: "w",
            });

            // Enviar el archivo XML
            await bot.sendMessage(number, "", {
              media: xmlFilePath,
            });

            // Borrar el archivo temporal después del envío
            if (existsSync(xmlFilePath)) {
              unlinkSync(xmlFilePath);
            }
          } catch (xmlError) {
            console.error("Error procesando XML:", xmlError);
            // Limpiar archivo si existe en caso de error
            if (existsSync(xmlFilePath)) {
              unlinkSync(xmlFilePath);
            }
            throw xmlError;
          }
        }

        // Si no hay PDF ni XML, enviar solo el mensaje
        if (!pdf && !xml && message) {
          await bot.sendMessage(number, message);
        }

        //Publicidad
        await bot.sendMessage(number, 'Enviado desde el Sistema de Punto de venta de PSA-SYSTEMS.', {
            media: null,
          });
        await bot.sendMessage(number, 'https://psa-systems.com/#/home', {
        media: null,
           });
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(
          JSON.stringify({
            status: "ok",
            message: `Mensaje enviado exitosamente a ${number}`,
          })
        );
      } catch (error) {
        console.error("Error enviando mensaje:", error);
        res.writeHead(500, { "Content-Type": "application/json" });
        return res.end(
          JSON.stringify({
            status: "error",
            message: `Error enviando mensaje: ${error.message}`,
          })
        );
      }
    })
  );

  adapterProvider.server.post(
    "/v1/register",
    handleCtx(async (bot, req, res) => {
      const { number, name } = req.body;
      await bot.dispatch("REGISTER_FLOW", { from: number, name });
      return res.end("trigger");
    })
  );

  adapterProvider.server.post(
    "/v1/samples",
    handleCtx(async (bot, req, res) => {
      const { number, name } = req.body;
      await bot.dispatch("SAMPLES", { from: number, name });
      return res.end("trigger");
    })
  );

  adapterProvider.server.post(
    "/v1/blacklist",
    handleCtx(async (bot, req, res) => {
      const { number, intent } = req.body;
      if (intent === "remove") bot.blacklist.remove(number);
      if (intent === "add") bot.blacklist.add(number);

      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ status: "ok", number, intent }));
    })
  );

  httpServer(+PORT);
};

main();
