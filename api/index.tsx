import { PrismaClient } from "@prisma/client";
import express from "express";
import { PermissionsBitField } from "discord.js";
var cors = require("cors");
const ogs = require("open-graph-scraper");
const prisma = new PrismaClient();
const app = express();
import * as dotenv from "dotenv";
dotenv.config();

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb" }));

const API_ENDPOINT = process.env.API_ENDPOINT || "";
interface interactionType {
  [key: string]: any;
}

app.post("/data", async (req: interactionType, res: any) => {
  let data = req.body;

  async function storeData(data: any) {
    let guild = data.guild;
    let channel = data.channel;
    let messages = data.message;

    const newGuild = await prisma.discordGuild.upsert({
      where: {
        id: guild.id,
      },
      update: {
        guildName: guild.name,
        guildAvatar: guild.guildAvatar,
      },
      create: {
        id: guild.id,
        guildName: guild.name,
        guildAvatar: guild.guildAvatar,
      },
    });
    const newChannel = await prisma.channel.upsert({
      where: {
        id: channel.id,
      },
      update: {
        channelName: channel.channelName,
        guildName: channel.guildName,
      },
      create: {
        id: channel.id,
        channelName: channel.channelName,
        discordGuildId: channel.guildId,
        guildName: channel.guildName,
      },
    });
    const newMessages = await prisma.message.createMany({
      data: messages,
      skipDuplicates: true,
    });

    if (newGuild && newChannel && newMessages) {
      return true;
    } else return false;
  }

  try {
    const posted = await storeData(data);
    if (posted === true) {
      res.send("All messages successfully saved to database");
    } else {
      res.send("Something went wrong saving the messages to the database");
    }
  } catch (err) {
    console.log(err);
  }
});

function getGuildAndChannelData(guildId: any, channelId: any) {
  if (channelId === null) {
    return prisma.discordGuild.findUnique({
      where: {
        id: guildId,
      },
      include: {
        channels: true,
      },
    });
  } else {
    return prisma.discordGuild.findUnique({
      where: {
        id: guildId,
      },
      include: {
        channels: {
          where: {
            id: channelId,
          },
          include: {
            messages: true,
          },
        },
      },
    });
  }
}

app.get("/guilds/:guildId/:channelId", async (req, res) => {
  getGuildAndChannelData(req.params.guildId, req.params.channelId).then(
    (data: any) => {
      if (data === null || data === undefined) {
        res.send("Guild not found");
      } else if (data.channels[0] === undefined || data.channels[0] === null) {
        res.send(`No Channels found by that id in ${data.guildName}`);
      } else if (
        data.channels[0].messages === undefined ||
        data.channels[0].messages === null
      ) {
        res.send("No messages found in channel");
      } else {
        let messages = JSON.stringify(
          data.channels[0].messages,
          (key, value) => (typeof value === "bigint" ? value.toString() : value) // return everything else unchanged
        );
        res.send(messages);
      }
    }
  );
});

app.get("/guilds/:guildId", async (req, res) => {
  getGuildAndChannelData(req.params.guildId, null).then((data: any) => {
    if (data === null || data === undefined) {
      res.send([]);
    } else {
      res.send([data]);
    }
  });
});

app.get("/guilds", async (req, res) => {
  prisma.discordGuild.findMany().then((data: any) => {
    if (data === null || data === undefined) {
      res.send("No guilds found by that id");
    } else {
      res.send(data);
    }
  });
});

app.post("/opengraph", async (req: { body: { url: string } }, res) => {
  const url = req.body.url;
  const options = { url: url, onlyGetOpenGraphInfo: true };
  ogs(options, function (error: any, results: any) {
    if (error) {
      res.send(error);
    } else {
      res.send(results);
    }
  });
});

app.post("/admincheck", async (req, res) => {
  let guilds = req.body;
  console.log(guilds);
  let guildsUserIsAdminIn = [];
  for (let i = 0; i < guilds.length; i++) {
    let permissionNumber = guilds[i].permissions;
    let permissions = new PermissionsBitField(BigInt(permissionNumber));
    if (permissions.has(PermissionsBitField.Flags.Administrator)) {
      guildsUserIsAdminIn.push(guilds[i]);
    }
  }
  res.send(guildsUserIsAdminIn);
  console.log(guildsUserIsAdminIn);
});

const PORT = process.env.PORT || 5000;
export function expressServer() {
  app.listen(PORT, () => {
    console.log("api server listening on port " + PORT);
  });
}
