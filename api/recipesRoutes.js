const express = require("express");
const router = express.Router();
const recipes = require("./recipesController");
// استخدام authMiddleware الموحد من auth/authMiddleware.js
const { authMiddleware } = require("../auth/authMiddleware");

// ===============================
//          ROUTES
// ===============================

router.get("/", authMiddleware, recipes.getRecipes);
router.get("/kpi", authMiddleware, recipes.getKPI);
router.get("/popular", authMiddleware, recipes.getPopularRecipes);
router.get("/recent", authMiddleware, recipes.getRecentRecipes);

// Routes للإنتاج (يجب أن تكون قبل /:id)
router.post("/:id/produce", authMiddleware, recipes.produceRecipe);
router.get("/productions/list", authMiddleware, recipes.getProductions);
router.get("/productions/:id", authMiddleware, recipes.getProduction);

router.post("/add", authMiddleware, recipes.addRecipe);
router.put("/edit/:id", authMiddleware, recipes.editRecipe);
router.delete("/delete/:id", authMiddleware, recipes.deleteRecipe);

// Route جلب وصفة واحدة (يجب أن يكون في النهاية)
router.get("/:id", authMiddleware, recipes.getRecipe);

module.exports = router;


