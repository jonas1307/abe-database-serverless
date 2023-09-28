const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  ScanCommand,
} = require("@aws-sdk/lib-dynamodb");
const express = require("express");
const serverless = require("serverless-http");
const { v4: uuidv4 } = require("uuid");

const app = express();

const POLLS_TABLE = process.env.POLLS_TABLE;
const VOTES_TABLE = process.env.VOTES_TABLE;
const client = new DynamoDBClient();
const dynamoDbClient = DynamoDBDocumentClient.from(client);

app.use(express.json());

const authorization = (req, res, next) => {
  const token = req.header("Authorization");
  if (!token) {
    return res.status(401).json({ message: "Access denied" });
  }
  if (token === "Bearer 1") {
    next();
  } else if (token === "Bearer 2") {
    return res.status(403).json({
      message: "User has no access to the requested resource",
    });
  } else {
    return res.status(401).json({ message: "Access denied" });
  }
};

// OBTER TODAS PESQUISAS
app.get("/polls", [authorization], async function (req, res) {
  const command = {
    TableName: POLLS_TABLE,
    FilterExpression: "enabled = :enabled",
    ExpressionAttributeValues: {
      ":enabled": true,
    },
  };

  try {
    const response = await dynamoDbClient.send(new ScanCommand(command));

    if (response) {
      res.json(response.Items);
    } else {
      res.status(404).json({ message: "Could not find polls in the database" });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Could not retreive poll", error: error });
  }
});

// OBTER PESQUISA POR ID
app.get("/polls/:pollId", [authorization], async function (req, res) {
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
        .json({ message: 'Could not find poll with provided "pollId"' });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Could not retreive poll", error: error });
  }
});

// CRIAR PESQUISA
app.post("/polls", [authorization], async function (req, res) {
  const { question, options } = req.body;
  if (typeof question !== "string") {
    res.status(400).json({ message: '"question" must be a string' });
  } else if (typeof options !== "object") {
    res.status(400).json({ message: '"options" must be a array of strings' });
  }

  const pollId = uuidv4();
  const databaseOptions = options.map((x) => ({ label: x, answers: 0 }));

  const params = {
    TableName: POLLS_TABLE,
    Item: {
      pollId: pollId,
      question: question,
      enabled: true,
      options: databaseOptions,
    },
  };

  try {
    await dynamoDbClient.send(new PutCommand(params));
    res.json({ pollId, question, enabled: true, options: databaseOptions });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Could not create poll", error });
  }
});

// ALTERAR PESQUISA
app.put("/polls", [authorization], async function (req, res) {
  const { pollId, label } = req.body;
  if (typeof pollId !== "string") {
    res.status(400).json({ message: '"pollId" must be a string' });
  } else if (typeof label !== "string") {
    res.status(400).json({ message: '"label" must be a string' });
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
        .json({ message: "Could not find the provided pollId" });
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
    res.json(Item);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Could not create vote", error: error });
  }
});

// DELETAR PESQUISA
app.delete("/polls/:pollId", [authorization], async function (req, res) {
  const params = {
    TableName: POLLS_TABLE,
    Key: {
      pollId: req.params.pollId,
    },
  };

  try {
    const { Item } = await dynamoDbClient.send(new GetCommand(params));

    if (Item) {
      await dynamoDbClient.send(new DeleteCommand(params));
      res.json(Item);
    } else {
      res
        .status(404)
        .json({ message: 'Could not find poll with provided "pollId"' });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Could not delete poll", error: error });
  }
});

app.use((req, res, next) => {
  return res.status(404).json({
    message: "Not Found",
  });
});

module.exports.handler = serverless(app);
