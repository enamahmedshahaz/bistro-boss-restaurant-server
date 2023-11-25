const express = require('express');
const app = express();
const jwt = require('jsonwebtoken');
const cors = require('cors');
require('dotenv').config();

const port = process.env.PORT || 5000;

//middleware 
app.use(cors());
app.use(express.json());


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.bmgmcoi.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    // Get the database and collection on which to run the operation
    const database = client.db("BistroBossDB");
    const userCollection = database.collection("users");
    const menuCollection = database.collection("menu");
    const reviewCollection = database.collection("reviews");
    const cartCollection = database.collection("carts");


    //jwt related api
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
      res.send({ token });
    });


    //middlewares
    const verifyToken = (req, res, next) => {
      console.log('Inside verify token: ', req.headers.authorization);
      //no authorization header
      if (!req.headers.authorization) {
        return res.status(401).send({ message: 'unauthorized access' })
      }
      // has authorization header, extract token from header and verify it 
      const token = req.headers.authorization.split(' ')[1];

      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        // token is not valid
        if (err) {
          return res.status(401).send({ message: 'unauthorized access' })
        }
        //token is valid 
        req.decoded = decoded;
        next();
      })
    }

    // use verifyAdmin after verifyToken
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === 'admin';
      if (!isAdmin) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      next();
    }

    // API to insert users data
    app.post('/users', async (req, res) => {
      const user = req.body;

      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: 'user already exists', insertedId: null });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    // API to get all users
    app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    // API to delete a user based on id
    app.delete('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await userCollection.deleteOne(query);
      res.send(result);
    });

    // API to set users role to admin
    app.patch('/users/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: 'admin'
        },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    /*
      To check if a user is admin: 
      You must be a logged in valid user (passes verifyToken Middleware )
      You can check only your email if it is admin, you can not check others email 
      If all the above requirement is fulfilled you have to check the document contains your  email has the role admin.
    */
    app.get('/users/admin/:email', verifyToken, async (req, res) => {
      const email = req.params.email;

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' })
      }

      const query = { email: email };
      const user = await userCollection.findOne(query);

      let admin = false;
      if (user) {
        admin = user?.role === 'admin';
      }
      res.send({ admin });
    });



    //API to get all menu items
    app.get('/menu', async (req, res) => {
      const cursor = menuCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    })

    //API to get all reviews
    app.get('/reviews', async (req, res) => {
      const cursor = reviewCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    // API to insert data into carts
    app.post('/carts', async (req, res) => {
      const cartItem = req.body;
      const result = await cartCollection.insertOne(cartItem);
      res.send(result);
    });

    // API to get cart collection by email
    app.get('/carts', async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const cursor = cartCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    //API to delete cart items based on id 
    app.delete('/carts/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    //  await client.close();
  }
}
run().catch(console.dir);


app.get("/", (req, res) => {
  res.send('Bistro-Boss server is running...');
});

app.listen(port, () => {
  console.log(`Bistro-Boss server is running on port ${port}...`);
});