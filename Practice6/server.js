const { ApolloServer, gql } = require('apollo-server-express');
const WebSocket = require('ws'); // Подключаем WebSocket
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const cors = require('cors');

// Путь к JSON-файлу с товарами
const dataFilePath = path.join(__dirname, './products.json');

const PORT = 3000;
const app = express();

// Разрешаем CORS
app.use(cors());
app.use(cors({
  origin: '*', // Можно заменить на нужные домены
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware для парсинга JSON
app.use(bodyParser.json());

// --- ФУНКЦИИ ДЛЯ РАБОТЫ С ФАЙЛОМ products.json ---
function readData() {
  try {
    const data = fs.readFileSync(dataFilePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Ошибка чтения файла:', error);
    return []; // Если файла нет, возвращаем пустой массив
  }
}

function writeData(data) {
  fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2), 'utf8');
}

// --- GraphQL СХЕМА И РЕЗОЛВЕРЫ ---
const typeDefs = gql`
  type Product {
    id: ID!
    name: String!
    price: Float!
    description: String
    categories: [String]
  }

  type Query {
    products: [Product]
    product(id: ID!): Product
  }
`;

const resolvers = {
  Query: {
    // Возвращаем все товары из JSON
    products: () => readData(),
    // Возвращаем товар по ID
    product: (_, { id }) => readData().find(p => p.id == id),
  }
};

// --- СТАТИЧЕСКИЕ ФАЙЛЫ И МАРШРУТЫ HTML ---
// Раздаём статические файлы из Practice5
app.use(express.static(path.join(__dirname, '../Practice5')));
app.use(express.static(path.join(__dirname, '../Practice6')));


// При GET-запросе на "/" отдаём index.html из Practice5
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../Practice5', 'index.html'));
});

// При GET-запросе на "/admin" отдаём admin.html из Practice5
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../Practice6', 'admin.html'));
});

// --- ИНИЦИАЛИЗАЦИЯ ДАННЫХ (ПРОДУКТЫ) ---
let products = readData();

// --- ИНИЦИАЛИЗАЦИЯ GraphQL-СЕРВЕРА ---
const server = new ApolloServer({ typeDefs, resolvers });

async function startServer() {
  // Запускаем Apollo Server
  await server.start();
  server.applyMiddleware({ app });

  // Настраиваем Swagger документацию
  const swaggerOptions = {
    swaggerDefinition: {
      openapi: '3.0.0',
      info: {
        title: 'Task Management API',
        version: '1.0.0',
        description: 'API для управления задачами (пример)',
      },
      servers: [
        {
          url: `http://localhost:${PORT}`,
        },
      ],
    },
    // Если есть файл openapi.yaml с описаниями, укажите его путь:
    apis: ['openapi.yaml'],
  };

  const swaggerDocs = swaggerJsDoc(swaggerOptions);
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

  // Запускаем HTTP-сервер
  app.listen(PORT, () => {
    console.log(`Сервер запущен на http://localhost:${PORT}`);
    console.log(`GraphQL: http://localhost:${PORT}/graphql`);
    console.log(`Swagger: http://localhost:${PORT}/api-docs`);
  });

  // Запускаем WebSocket-сервер на порту 8080
  const wss = new WebSocket.Server({ port: 8080 });
  wss.on('connection', (ws) => {
    console.log('Новое подключение к WebSocket серверу');

    ws.on('message', (message) => {
        // Преобразуем Buffer в строку:
        const textMessage = message.toString();
        console.log('Сообщение получено:', textMessage);

        // Рассылаем текстовое сообщение всем подключённым клиентам
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(textMessage);
            }
        });
    });

    ws.on('close', () => {
        console.log('Клиент отключился');
    });
});


  console.log('WebSocket сервер запущен на ws://localhost:8080');
}

// --- REST API ДЛЯ /products ---
app.get('/products', (req, res) => {
  res.json(products);
});

app.post('/products', (req, res) => {
  const newProduct = {
    id: products.length > 0 ? products[products.length - 1].id + 1 : 1,
    name: req.body.name,
    price: req.body.price,
    description: req.body.description,
    categories: req.body.categories
  };
  products.push(newProduct);
  writeData(products);
  res.status(201).json(newProduct);
});

app.get('/products/:id', (req, res) => {
  const productId = parseInt(req.params.id);
  const product = products.find(p => p.id === productId);
  if (product) {
    res.json(product);
  } else {
    res.status(404).json({ message: 'Product not found' });
  }
});

app.put('/products/:id', (req, res) => {
  const productId = parseInt(req.params.id);
  const product = products.find(p => p.id === productId);
  if (product) {
    product.name = req.body.name ?? product.name;
    product.price = req.body.price ?? product.price;
    product.description = req.body.description ?? product.description;
    product.categories = req.body.categories ?? product.categories;
    writeData(products);
    res.json(product);
  } else {
    res.status(404).json({ message: 'Product not found' });
  }
});

app.delete('/products/:id', (req, res) => {
  const productId = parseInt(req.params.id);
  const newProducts = products.filter(p => p.id !== productId);
  if (newProducts.length !== products.length) {
    products = newProducts;
    writeData(products);
    res.status(204).send();
  } else {
    res.status(404).json({ message: 'Product not found' });
  }
});

// Запуск сервера (Apollo + Express + WebSocket)
startServer();
