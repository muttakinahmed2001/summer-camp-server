const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);
const port = process.env.PORT || 5000;

// middleware

app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "unauthorized access" });
  }
  const token = authorization.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: "unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ftwwmzw.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)

    const usersCollection = client.db("summerCampDb").collection("users");
    const classCollection = client.db("summerCampDb").collection("classes");
    const selectedClassCollection = client
      .db("summerCampDb")
      .collection("selectedClasses");
    const paymentCollection = client.db("summerCampDb").collection("payments");
    const enrolledCollection = client.db("summerCampDb").collection("enrolled");

    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user?.role !== "admin") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden message" });
      }
      next();
    };

    // users related apis

    app.get("/users", verifyJWT, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      console.log(user);
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      console.log("existing user", existingUser);
      if (existingUser) {
        return res.send({ message: "user already exists" });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    // admin api

    app.get("/users/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ admin: false });
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === "admin" };
      res.send(result);
    });

    app.patch(`/users/admin/:id`, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          role: "admin",
        },
      };

      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // instructor api

    app.get("/instructors", async (req, res) => {
      let query = {};
      if (req.query?.role) {
        query = { role: req.query.role };
      }

      const result = await usersCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/users/instructor/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ instructor: false });
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { instructor: user?.role === "instructor" };
      res.send(result);
    });

    app.patch(`/users/instructor/:id`, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          role: "instructor",
        },
      };

      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // class api
    app.get("/classes", verifyJWT, async (req, res) => {
      const result = await classCollection.find().toArray();

      res.send(result);
    });

    app.get("/classes/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await classCollection.findOne(query);
      res.send(result);
    });

    app.get("/classesByEmail", async (req, res) => {
      let query = {};
      if (req.query?.email) {
        query = { instructorEmail: req.query.email };
      }
      const result = await classCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/classesByStatus", async (req, res) => {
      let query = {};
      if (req.query?.status) {
        query = { status: req.query.status };
      }
      const result = await classCollection.find(query).toArray();
      res.send(result);
    });
    app.post("/classes", async (req, res) => {
      const languageClass = req.body;
      languageClass.status = "Pending";
      const result = await classCollection.insertOne(languageClass);

      res.send(result);
    });

    app.patch(`/classes/approve/:id`, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: "Approved",
        },
      };
      const result = await classCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.patch(`/classes/deny/:id`, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: "Denied",
        },
      };
      const result = await classCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.patch(`/classes/feedback/:id`, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const feedback = {
        $set: {
          ...req.body,
        },
      };

      const result = await classCollection.updateOne(filter, feedback);
      res.send(result);
    });

    // selected class api

    app.get("/selectedClass", async (req, res) => {
      const result = await selectedClassCollection.find().toArray();
      res.send(result);
    });

    app.get("/selectedClass/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await selectedClassCollection.findOne(query);
      res.send(result);
    });

    app.delete("/selectedClass/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await selectedClassCollection.deleteOne(query);
      res.send(result);
    });
    app.get("/selectedClassesByEmail", async (req, res) => {
      let query = {};
      if (req.query?.email) {
        query = { email: req.query.email };
      }
      const result = await selectedClassCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/selectedClasses", async (req, res) => {
      const selectedClass = req.body;
      console.log(selectedClass);

      const result = await selectedClassCollection.insertOne(selectedClass);
      res.send(result);
    });

    // payment

    app.post("/create-payment-intent", async (req, res) => {
      const { price, AvailableSeat } = req.body;
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.post("/paymentClasses", async (req, res) => {
      const { enrolledClasses, transactionId } = req.body;
      console.log(enrolledClasses);
      console.log(transactionId);

      const { ClassName } = enrolledClasses;

      try {
        const filter = { ClassName: ClassName };
        const updateDoc = {
          $inc: {
            AvailableSeat: -1,
          },
        };
        await classCollection.updateOne(filter, updateDoc);

        const selectedClassFilter = { ClassName: ClassName };
        await selectedClassCollection.deleteOne(selectedClassFilter);

        const paymentHistory = await paymentCollection.insertOne(transactionId);
        const enrolledClass = await enrolledCollection.insertOne(
          enrolledClasses
        );
        res.send({ paymentHistory, enrolledClass });
      } catch (error) {
        res.status(500).json({ error: "Internal server error" });
      }
    });

    app.get("/enrolledClassesByEmail", async (req, res) => {
      let query = {};
      if (req.query?.email) {
        query = { email: req.query.email };
      }

      const result = await enrolledCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/enrolledClasses", async (req, res) => {
      try {
        const pipeline = [
          {
            $group: {
              _id: "$ClassName",
              totalEnrollment: { $sum: 1 },
              ClassImage: { $first: "$ClassImage" },
              instructorName: { $first: "$instructorName" },
              email: { $first: "$email" },
              instructorEmail: { $first: "$instructorEmail" },
              price: { $first: "$price" },
              AvailableSeat: { $first: "$AvailableSeat" },
            },
          },
          {
            $sort: { totalEnrollment: -1 },
          },
        ];

        const result = await enrolledCollection.aggregate(pipeline).toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching and processing data:", error);
        res.status(500).send("Internal Server Error");
      }
    });

    app.get("/totalEnrolledStudents", async (req, res) => {
      const { instructorName } = req.query;

      try {
        const filter = { instructorName: instructorName };
        const totalEnrolledStudents = await enrolledCollection.countDocuments(
          filter
        );

        res.send({ totalEnrolledStudents });
      } catch (error) {
        res.status(500).json({ error: "Internal server error" });
      }
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Assignment-12 is running");
});

app.listen(port, () => {
  console.log(`Assignment -12 is running on ${port}`);
});
