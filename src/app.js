"use strict";

// src/app.js

import { Post } from "./post";
import { User } from "./user";
import { ui } from "./ui";

Post.findAll()
  .then(ui.renderPosts)
  .catch((error) => {
    console.error("Error: ", error);
  });

User.findRecent()
  .then(ui.renderUsers)
  .catch((error) => {
    console.error("Error: ", error);
  });
