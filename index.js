const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
} = require("@aws-sdk/lib-dynamodb");
const express = require("express");
const serverless = require("serverless-http");

const app = express();

const POLLS_TABLE = process.env.POLLS_TABLE;
const VOTES_TABLE = process.env.VOTES_TABLE;
const client = new DynamoDBClient();
const dynamoDbClient = DynamoDBDocumentClient.from(client);

app.use(express.json());

app.get("/polls/:pollId", async function (req, res) {
  const params = {
    TableName: POLLS_TABLE,
    Key: {
      pollId: req.params.pollId,
    },
  };

  try {
    const { Item } = await dynamoDbClient.send(new GetCommand(params));
    if (Item) {
      const { pollId, name } = Item;
      res.json(Item);
    } else {
      res
        .status(404)
        .json({ error: 'Could not find poll with provided "pollId"' });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Could not retreive poll" });
  }
});

app.post("/polls", async function (req, res) {
  const { pollId, question, options } = req.body;
  if (typeof pollId !== "string") {
    res.status(400).json({ error: '"pollId" must be a string' });
  } else if (typeof question !== "string") {
    res.status(400).json({ error: '"question" must be a string' });
  } else if (typeof options !== "object") {
    res.status(400).json({ error: '"options" must be a array of strings' });
  }

  const databaseOptions = options.map((x) => ({ label: x, answers: 0 }));

  const params = {
    TableName: POLLS_TABLE,
    Item: {
      pollId: pollId,
      question: question,
      options: databaseOptions,
    },
  };

  try {
    await dynamoDbClient.send(new PutCommand(params));
    res.json({ pollId, question, options: databaseOptions });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Could not create poll", error: error });
  }
});

app.post("/votes", async function (req, res) {
  const { pollId, label } = req.body;
  if (typeof pollId !== "string") {
    res.status(400).json({ error: '"pollId" must be a string' });
  } else if (typeof label !== "string") {
    res.status(400).json({ error: '"label" must be a string' });
  }

  let params = {
    TableName: POLLS_TABLE,
    Key: {
      pollId: pollId,
    },
  };

  try {
    const { Item } = await dynamoDbClient.send(new GetCommand(params));

    if (!Item) {
      return res
        .status(404)
        .json({ error: "Could not find the provided pollId" });
    }

    let options = Item.options;

    //Find index of specific object using findIndex method.
    const objIndex = options.findIndex((obj) => obj.label === label);

    //Update object's name property.
    options[objIndex].answers += 1;

    params = {
      TableName: POLLS_TABLE,
      Key: {
        pollId: Item.pollId,
      },
      UpdateExpression: "set options = :options",
      ExpressionAttributeValues: {
        ":options": options,
      },
    };

    await dynamoDbClient.send(new UpdateCommand(params));
    res.json({ message: "ok" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Could not create vote", error: error });
  }
});

app.use((req, res, next) => {
  return res.status(404).json({
    error: "Not Found",
  });
});

module.exports.handler = serverless(app);
