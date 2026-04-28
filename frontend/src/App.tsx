import { useEffect, useMemo, useState } from "react";
import {
  Add,
  ArrowBack,
  DeleteOutline,
  Edit,
  Favorite,
  FavoriteBorder,
  Restaurant,
  Save,
  Search,
} from "@mui/icons-material";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Rating,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  addIngredientPrice,
  Category,
  createCategory,
  createIngredient,
  createRecipe,
  deleteRecipe,
  getRecipe,
  Ingredient,
  listCategories,
  listIngredients,
  listMealPlan,
  listRecipes,
  MealPlanEntry,
  Recipe,
  RecipeIngredient,
  RecipePayload,
  RecipeStep,
  RecipeSummary,
  RecipeUnit,
  saveMealPlan,
  UNIT_OPTIONS,
  updateCategory,
  updateIngredient,
  updateRecipe,
} from "./api/recipes";

type Draft = RecipePayload;
type TabKey = "recipes" | "categories" | "ingredients" | "week";
type RecipeMode = "list" | "view" | "edit";

const emptyDraft = (): Draft => ({
  title: "",
  description: "",
  category_id: null,
  favorite: false,
  rating: null,
  user_note: "",
  servings: 2,
  prep_minutes: null,
  cook_minutes: null,
  image_ref: "",
  ingredients: [],
  steps: [],
});

const categoryColors = ["#48624c", "#b75d46", "#bd7b32", "#5f6f91", "#8a5a72"];
const weekdays = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"];

function money(value?: number | null) {
  if (value === null || value === undefined) return "Sin precio";
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(value);
}

function recipeToDraft(recipe: Recipe): Draft {
  return {
    title: recipe.title,
    description: recipe.description ?? "",
    category_id: recipe.category_id ?? null,
    favorite: recipe.favorite,
    rating: recipe.rating ?? null,
    user_note: recipe.user_note ?? "",
    servings: recipe.servings,
    prep_minutes: recipe.prep_minutes ?? null,
    cook_minutes: recipe.cook_minutes ?? null,
    image_ref: recipe.image_ref ?? "",
    ingredients: recipe.ingredients.map(({ id: _id, estimated_cost: _cost, ...item }) => item),
    steps: recipe.steps.map(({ id: _id, ...step }) => step),
  };
}

export default function App() {
  const [tab, setTab] = useState<TabKey>("recipes");
  const [recipeMode, setRecipeMode] = useState<RecipeMode>("list");
  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [mealPlan, setMealPlan] = useState<MealPlanEntry[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState("");
  const [newIngredient, setNewIngredient] = useState<{
    name: string;
    default_unit: RecipeUnit;
    price: string;
    source: string;
  }>({ name: "", default_unit: "unit", price: "", source: "" });

  const ingredientNames = useMemo(
    () => ingredients.map((ingredient) => ingredient.name),
    [ingredients],
  );

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [recipeRows, categoryRows, ingredientRows, planRows] = await Promise.all([
        listRecipes({ q: search }),
        listCategories(),
        listIngredients(),
        listMealPlan(),
      ]);
      setRecipes(recipeRows);
      setCategories(categoryRows);
      setIngredients(ingredientRows);
      setMealPlan(planRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar Recipes");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function openRecipe(id: string) {
    setError(null);
    try {
      const recipe = await getRecipe(id);
      setSelectedRecipe(recipe);
      setDraft(recipeToDraft(recipe));
      setRecipeMode("view");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo abrir la receta");
    }
  }

  function startNewRecipe() {
    setSelectedRecipe(null);
    setDraft(emptyDraft());
    setRecipeMode("edit");
  }

  function startEditRecipe() {
    if (!selectedRecipe) return;
    setDraft(recipeToDraft(selectedRecipe));
    setRecipeMode("edit");
  }

  async function saveRecipe() {
    if (!draft.title.trim()) {
      setError("La receta necesita un titulo.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload: Draft = {
        ...draft,
        title: draft.title.trim(),
        description: draft.description || null,
        user_note: draft.user_note || null,
        image_ref: draft.image_ref || null,
        ingredients: draft.ingredients
          .filter((item) => item.name.trim())
          .map((item, index) => ({ ...item, name: item.name.trim(), position: index })),
        steps: draft.steps
          .filter((step) => step.text.trim())
          .map((step, index) => ({ text: step.text.trim(), position: index })),
      };
      const saved = selectedRecipe
        ? await updateRecipe(selectedRecipe.id, payload)
        : await createRecipe(payload);
      await loadAll();
      setSelectedRecipe(saved);
      setDraft(recipeToDraft(saved));
      setRecipeMode("view");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la receta");
    } finally {
      setSaving(false);
    }
  }

  async function removeRecipe() {
    if (!selectedRecipe || !window.confirm("Eliminar esta receta?")) return;
    setSaving(true);
    try {
      await deleteRecipe(selectedRecipe.id);
      setSelectedRecipe(null);
      setDraft(emptyDraft());
      setRecipeMode("list");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar la receta");
    } finally {
      setSaving(false);
    }
  }

  async function addCategory() {
    if (!newCategory.trim()) return;
    const color = categoryColors[categories.length % categoryColors.length];
    await createCategory({ name: newCategory.trim(), color });
    setNewCategory("");
    await loadAll();
  }

  async function saveCategory(category: Category) {
    await updateCategory(category.id, category);
    await loadAll();
  }

  async function addIngredientToCatalog() {
    if (!newIngredient.name.trim()) return;
    const ingredient = await createIngredient({
      name: newIngredient.name.trim(),
      default_unit: newIngredient.default_unit,
    });
    if (newIngredient.price) {
      await addIngredientPrice(ingredient.id, {
        price: Number(newIngredient.price),
        quantity: 1,
        unit: newIngredient.default_unit,
        source: newIngredient.source || null,
      });
    }
    setNewIngredient({ name: "", default_unit: "unit", price: "", source: "" });
    await loadAll();
  }

  async function saveIngredient(ingredient: Ingredient) {
    await updateIngredient(ingredient.id, {
      name: ingredient.name,
      default_unit: ingredient.default_unit ?? "unit",
      notes: ingredient.notes ?? null,
    });
    await loadAll();
  }

  function addIngredientLine(ingredient?: Ingredient) {
    setDraft((current) => ({
      ...current,
      ingredients: [
        ...current.ingredients,
        {
          ingredient_id: ingredient?.id ?? null,
          name: ingredient?.name ?? "",
          quantity: 1,
          unit: ingredient?.default_unit ?? "unit",
          note: "",
          position: current.ingredients.length,
        },
      ],
    }));
  }

  function updateIngredientLine(index: number, patch: Partial<RecipeIngredient>) {
    setDraft((current) => ({
      ...current,
      ingredients: current.ingredients.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    }));
  }

  function updateStep(index: number, patch: Partial<RecipeStep>) {
    setDraft((current) => ({
      ...current,
      steps: current.steps.map((step, stepIndex) =>
        stepIndex === index ? { ...step, ...patch } : step,
      ),
    }));
  }

  async function addMealPlanRecipe(weekday: number, recipeId: string) {
    const next = [
      ...mealPlan.map(({ weekday, position, recipe_id, note }) => ({
        weekday,
        position,
        recipe_id,
        note,
      })),
      {
        weekday,
        position: mealPlan.filter((entry) => entry.weekday === weekday).length,
        recipe_id: recipeId,
        note: null,
      },
    ];
    setMealPlan(await saveMealPlan(next));
  }

  async function removeMealPlanEntry(id: string) {
    const next = mealPlan
      .filter((entry) => entry.id !== id)
      .map(({ weekday, position, recipe_id, note }) => ({
        weekday,
        position,
        recipe_id,
        note,
      }));
    setMealPlan(await saveMealPlan(next));
  }

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <Paper square elevation={0} sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
        <Box sx={{ maxWidth: 1440, mx: "auto", px: { xs: 2, md: 3 }, pt: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ pb: 1.5 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 2,
                bgcolor: "primary.main",
                color: "#fff",
                display: "grid",
                placeItems: "center",
              }}
            >
              <Restaurant />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h5" fontWeight={800}>
                Recipes
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Recetario local, costos de referencia y menu semanal
              </Typography>
            </Box>
          </Stack>
          <Tabs value={tab} onChange={(_event, value: TabKey) => setTab(value)}>
            <Tab value="recipes" label="Recetas" />
            <Tab value="categories" label="Categorias" />
            <Tab value="ingredients" label="Ingredientes" />
            <Tab value="week" label="Menu semanal" />
          </Tabs>
        </Box>
      </Paper>

      <Box sx={{ maxWidth: 1440, mx: "auto", p: { xs: 2, md: 3 } }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {loading ? (
          <Stack alignItems="center" sx={{ py: 8 }}>
            <CircularProgress />
          </Stack>
        ) : (
          <>
            {tab === "recipes" && (
              <RecipesTab
                recipes={recipes}
                categories={categories}
                ingredients={ingredients}
                ingredientNames={ingredientNames}
                recipeMode={recipeMode}
                selectedRecipe={selectedRecipe}
                draft={draft}
                saving={saving}
                search={search}
                onSearch={setSearch}
                onReload={() => void loadAll()}
                onOpen={(id) => void openRecipe(id)}
                onBack={() => setRecipeMode("list")}
                onNew={startNewRecipe}
                onEdit={startEditRecipe}
                onDelete={() => void removeRecipe()}
                onSave={() => void saveRecipe()}
                onDraft={setDraft}
                onAddIngredientLine={addIngredientLine}
                onUpdateIngredientLine={updateIngredientLine}
                onUpdateStep={updateStep}
              />
            )}
            {tab === "categories" && (
              <CategoriesTab
                categories={categories}
                newCategory={newCategory}
                onNewCategory={setNewCategory}
                onAddCategory={() => void addCategory()}
                onSaveCategory={(category) => void saveCategory(category)}
              />
            )}
            {tab === "ingredients" && (
              <IngredientsTab
                ingredients={ingredients}
                newIngredient={newIngredient}
                onNewIngredient={setNewIngredient}
                onAddIngredient={() => void addIngredientToCatalog()}
                onSaveIngredient={(ingredient) => void saveIngredient(ingredient)}
              />
            )}
            {tab === "week" && (
              <WeekTab
                recipes={recipes}
                mealPlan={mealPlan}
                onAdd={(weekday, recipeId) => void addMealPlanRecipe(weekday, recipeId)}
                onRemove={(id) => void removeMealPlanEntry(id)}
              />
            )}
          </>
        )}
      </Box>
    </Box>
  );
}

function RecipesTab(props: {
  recipes: RecipeSummary[];
  categories: Category[];
  ingredients: Ingredient[];
  ingredientNames: string[];
  recipeMode: RecipeMode;
  selectedRecipe: Recipe | null;
  draft: Draft;
  saving: boolean;
  search: string;
  onSearch: (value: string) => void;
  onReload: () => void;
  onOpen: (id: string) => void;
  onBack: () => void;
  onNew: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSave: () => void;
  onDraft: (value: Draft | ((current: Draft) => Draft)) => void;
  onAddIngredientLine: (ingredient?: Ingredient) => void;
  onUpdateIngredientLine: (index: number, patch: Partial<RecipeIngredient>) => void;
  onUpdateStep: (index: number, patch: Partial<RecipeStep>) => void;
}) {
  if (props.recipeMode === "view" && props.selectedRecipe) {
    return <RecipeDetail {...props} recipe={props.selectedRecipe} />;
  }
  if (props.recipeMode === "edit") {
    return <RecipeEditor {...props} />;
  }
  return <RecipeBook {...props} />;
}

function RecipeBook(props: {
  recipes: RecipeSummary[];
  search: string;
  onSearch: (value: string) => void;
  onReload: () => void;
  onOpen: (id: string) => void;
  onNew: () => void;
}) {
  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
        <TextField
          label="Buscar recetas"
          value={props.search}
          onChange={(event) => props.onSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") props.onReload();
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search fontSize="small" />
              </InputAdornment>
            ),
          }}
          sx={{ flex: 1 }}
        />
        <Button startIcon={<Add />} variant="contained" onClick={props.onNew}>
          Nueva receta
        </Button>
      </Stack>
      {props.recipes.length === 0 ? (
        <Alert severity="info">Crea la primera receta para empezar tu libro.</Alert>
      ) : (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: 2,
          }}
        >
          {props.recipes.map((recipe) => (
            <Paper
              key={recipe.id}
              variant="outlined"
              onClick={() => props.onOpen(recipe.id)}
              sx={{ p: 2, cursor: "pointer", minHeight: 180 }}
            >
              <Stack spacing={1.25} sx={{ height: "100%" }}>
                <Stack direction="row" spacing={1} alignItems="flex-start">
                  <Typography variant="h6" fontWeight={800} sx={{ flex: 1 }}>
                    {recipe.title}
                  </Typography>
                  {recipe.favorite && <Favorite color="secondary" fontSize="small" />}
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
                  {recipe.description || "Sin descripcion."}
                </Typography>
                <Stack direction="row" spacing={0.75} flexWrap="wrap">
                  {recipe.category_name && <Chip size="small" label={recipe.category_name} />}
                  <Chip size="small" label={`${recipe.servings} porciones`} />
                  <Chip size="small" label={money(recipe.estimated_cost)} />
                </Stack>
              </Stack>
            </Paper>
          ))}
        </Box>
      )}
    </Stack>
  );
}

function RecipeDetail(props: {
  recipe: Recipe;
  onBack: () => void;
  onEdit: () => void;
}) {
  const totalMinutes = (props.recipe.prep_minutes ?? 0) + (props.recipe.cook_minutes ?? 0);
  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Button startIcon={<ArrowBack />} onClick={props.onBack}>
          Recetas
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button startIcon={<Edit />} variant="contained" onClick={props.onEdit}>
          Editar
        </Button>
      </Stack>
      <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="h4" fontWeight={900} sx={{ flex: 1 }}>
              {props.recipe.title}
            </Typography>
            {props.recipe.favorite && <Favorite color="secondary" />}
          </Stack>
          <Typography color="text.secondary">{props.recipe.description}</Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {props.recipe.category_name && <Chip label={props.recipe.category_name} />}
            <Chip label={`${props.recipe.servings} porciones`} />
            {totalMinutes > 0 && <Chip label={`${totalMinutes} min`} />}
            <Chip label={`Costo ref. ${money(props.recipe.estimated_cost)}`} />
            <Chip label={`Por porcion ${money(props.recipe.estimated_cost_per_serving)}`} />
          </Stack>
          {props.recipe.rating && <Rating value={props.recipe.rating} readOnly />}
          {props.recipe.user_note && <Alert severity="info">{props.recipe.user_note}</Alert>}
          <Divider />
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 3 }}>
            <Box>
              <Typography variant="h6" gutterBottom>
                Ingredientes
              </Typography>
              <Stack spacing={1}>
                {props.recipe.ingredients.map((ingredient) => (
                  <Paper key={ingredient.id} variant="outlined" sx={{ p: 1.25 }}>
                    <Typography fontWeight={800}>{ingredient.name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {ingredient.quantity ?? ""} {ingredient.unit ?? ""} · ref.{" "}
                      {money(ingredient.estimated_cost)}
                    </Typography>
                  </Paper>
                ))}
              </Stack>
            </Box>
            <Box>
              <Typography variant="h6" gutterBottom>
                Preparacion
              </Typography>
              <Stack spacing={1}>
                {props.recipe.steps.map((step, index) => (
                  <Stack key={step.id} direction="row" spacing={1}>
                    <Chip label={index + 1} />
                    <Typography>{step.text}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Box>
          </Box>
        </Stack>
      </Paper>
    </Stack>
  );
}

function RecipeEditor(props: {
  categories: Category[];
  ingredients: Ingredient[];
  ingredientNames: string[];
  draft: Draft;
  saving: boolean;
  selectedRecipe: Recipe | null;
  onBack: () => void;
  onDelete: () => void;
  onSave: () => void;
  onDraft: (value: Draft | ((current: Draft) => Draft)) => void;
  onAddIngredientLine: (ingredient?: Ingredient) => void;
  onUpdateIngredientLine: (index: number, patch: Partial<RecipeIngredient>) => void;
  onUpdateStep: (index: number, patch: Partial<RecipeStep>) => void;
}) {
  const setDraft = props.onDraft;
  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
      <Stack spacing={2}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Button startIcon={<ArrowBack />} onClick={props.onBack}>
            Cancelar
          </Button>
          <Typography variant="h5" fontWeight={900} sx={{ flex: 1 }}>
            {props.selectedRecipe ? "Editar receta" : "Nueva receta"}
          </Typography>
          <Button
            startIcon={props.saving ? <CircularProgress size={16} /> : <Save />}
            variant="contained"
            disabled={props.saving}
            onClick={props.onSave}
          >
            Guardar
          </Button>
        </Stack>

        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
          <TextField
            label="Titulo"
            value={props.draft.title}
            onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
            fullWidth
          />
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>Categoria</InputLabel>
            <Select
              label="Categoria"
              value={props.draft.category_id ?? ""}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  category_id: event.target.value || null,
                }))
              }
            >
              <MenuItem value="">Sin categoria</MenuItem>
              {props.categories.map((category) => (
                <MenuItem key={category.id} value={category.id}>
                  {category.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Tooltip title="Favorita">
            <IconButton
              color={props.draft.favorite ? "secondary" : "default"}
              onClick={() =>
                setDraft((current) => ({ ...current, favorite: !current.favorite }))
              }
              sx={{ cursor: "pointer", "&:hover": { bgcolor: "transparent" } }}
            >
              {props.draft.favorite ? <Favorite /> : <FavoriteBorder />}
            </IconButton>
          </Tooltip>
        </Stack>

        <TextField
          label="Descripcion"
          value={props.draft.description ?? ""}
          onChange={(event) =>
            setDraft((current) => ({ ...current, description: event.target.value }))
          }
          multiline
          minRows={2}
        />

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(4, 1fr)" }, gap: 1.5 }}>
          <TextField
            label="Porciones"
            type="number"
            value={props.draft.servings}
            onChange={(event) =>
              setDraft((current) => ({ ...current, servings: Math.max(1, Number(event.target.value) || 1) }))
            }
          />
          <TextField
            label="Prep. min"
            type="number"
            value={props.draft.prep_minutes ?? ""}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                prep_minutes: event.target.value ? Number(event.target.value) : null,
              }))
            }
          />
          <TextField
            label="Coccion min"
            type="number"
            value={props.draft.cook_minutes ?? ""}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                cook_minutes: event.target.value ? Number(event.target.value) : null,
              }))
            }
          />
          <Box>
            <Typography variant="caption" color="text.secondary">
              Nota
            </Typography>
            <Rating
              value={props.draft.rating ?? 0}
              onChange={(_event, value) =>
                setDraft((current) => ({ ...current, rating: value }))
              }
            />
          </Box>
        </Box>

        <TextField
          label="Foto o imagen"
          placeholder="Ruta local, URL o referencia generada por Forger"
          value={props.draft.image_ref ?? ""}
          onChange={(event) => setDraft((current) => ({ ...current, image_ref: event.target.value }))}
        />
        <TextField
          label="Nota personal"
          value={props.draft.user_note ?? ""}
          onChange={(event) => setDraft((current) => ({ ...current, user_note: event.target.value }))}
          multiline
          minRows={2}
        />

        <Divider />
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography variant="h6">Ingredientes</Typography>
            <Typography variant="body2" color="text.secondary">
              Escribe para sugerir ingredientes existentes. Si no existe, se agrega al catalogo al guardar.
            </Typography>
          </Box>
          <Button startIcon={<Add />} onClick={() => props.onAddIngredientLine()}>
            Agregar
          </Button>
        </Stack>
        <Stack spacing={1}>
          {props.draft.ingredients.map((item, index) => {
            const selected = props.ingredients.find((ingredient) => ingredient.id === item.ingredient_id);
            return (
              <Box
                key={index}
                sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "2fr 1fr 1fr auto" }, gap: 1 }}
              >
                <Autocomplete
                  freeSolo
                  options={props.ingredientNames}
                  value={item.name}
                  onChange={(_event, value) => {
                    const match = props.ingredients.find((ingredient) => ingredient.name === value);
                    props.onUpdateIngredientLine(index, {
                      ingredient_id: match?.id ?? null,
                      name: value ?? "",
                      unit: match?.default_unit ?? item.unit ?? "unit",
                    });
                  }}
                  onInputChange={(_event, value) => {
                    const match = props.ingredients.find((ingredient) => ingredient.name === value);
                    props.onUpdateIngredientLine(index, {
                      ingredient_id: match?.id ?? null,
                      name: value,
                      unit: match?.default_unit ?? item.unit ?? "unit",
                    });
                  }}
                  renderInput={(params) => (
                    <TextField {...params} size="small" label="Ingrediente" helperText={selected ? "Del catalogo" : "Nuevo o libre"} />
                  )}
                />
                <TextField
                  size="small"
                  label="Cantidad"
                  type="number"
                  value={item.quantity ?? ""}
                  onChange={(event) =>
                    props.onUpdateIngredientLine(index, {
                      quantity: event.target.value ? Number(event.target.value) : null,
                    })
                  }
                />
                <FormControl size="small">
                  <InputLabel>Unidad</InputLabel>
                  <Select
                    label="Unidad"
                    value={item.unit ?? "unit"}
                    onChange={(event) =>
                      props.onUpdateIngredientLine(index, { unit: event.target.value as RecipeUnit })
                    }
                  >
                    {UNIT_OPTIONS.map((unit) => (
                      <MenuItem key={unit} value={unit}>
                        {unit}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Tooltip title="Quitar ingrediente">
                  <IconButton
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        ingredients: current.ingredients.filter((_line, lineIndex) => lineIndex !== index),
                      }))
                    }
                  >
                    <DeleteOutline />
                  </IconButton>
                </Tooltip>
              </Box>
            );
          })}
        </Stack>

        <Divider />
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="h6">Pasos</Typography>
          <Button
            startIcon={<Add />}
            onClick={() =>
              setDraft((current) => ({
                ...current,
                steps: [...current.steps, { text: "", position: current.steps.length }],
              }))
            }
          >
            Agregar
          </Button>
        </Stack>
        <Stack spacing={1}>
          {props.draft.steps.map((step, index) => (
            <Stack key={index} direction="row" spacing={1} alignItems="flex-start">
              <Chip label={index + 1} sx={{ mt: 1 }} />
              <TextField
                size="small"
                multiline
                fullWidth
                minRows={2}
                value={step.text}
                onChange={(event) => props.onUpdateStep(index, { text: event.target.value })}
              />
              <IconButton
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    steps: current.steps.filter((_line, lineIndex) => lineIndex !== index),
                  }))
                }
              >
                <DeleteOutline />
              </IconButton>
            </Stack>
          ))}
        </Stack>

        <Stack direction="row" spacing={1} justifyContent="space-between">
          <Button color="error" startIcon={<DeleteOutline />} disabled={!props.selectedRecipe} onClick={props.onDelete}>
            Eliminar
          </Button>
          <Button startIcon={<Save />} variant="contained" onClick={props.onSave} disabled={props.saving}>
            Guardar receta
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}

function CategoriesTab(props: {
  categories: Category[];
  newCategory: string;
  onNewCategory: (value: string) => void;
  onAddCategory: () => void;
  onSaveCategory: (category: Category) => void;
}) {
  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
        <TextField label="Nueva categoria" value={props.newCategory} onChange={(event) => props.onNewCategory(event.target.value)} sx={{ flex: 1 }} />
        <Button variant="contained" startIcon={<Add />} onClick={props.onAddCategory}>
          Crear
        </Button>
      </Stack>
      {props.categories.map((category) => (
        <CategoryRow key={category.id} category={category} onSave={props.onSaveCategory} />
      ))}
    </Stack>
  );
}

function CategoryRow(props: { category: Category; onSave: (category: Category) => void }) {
  const [draft, setDraft] = useState(props.category);
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems="center">
        <TextField label="Nombre" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} sx={{ flex: 1 }} />
        <TextField label="Color" value={draft.color} onChange={(event) => setDraft({ ...draft, color: event.target.value })} sx={{ width: 140 }} />
        <Chip label={draft.name || "Categoria"} sx={{ bgcolor: draft.color, color: "#fff" }} />
        <Button onClick={() => props.onSave(draft)}>Guardar</Button>
      </Stack>
    </Paper>
  );
}

function IngredientsTab(props: {
  ingredients: Ingredient[];
  newIngredient: { name: string; default_unit: RecipeUnit; price: string; source: string };
  onNewIngredient: (value: { name: string; default_unit: RecipeUnit; price: string; source: string }) => void;
  onAddIngredient: () => void;
  onSaveIngredient: (ingredient: Ingredient) => void;
}) {
  return (
    <Stack spacing={2}>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
          <TextField label="Ingrediente" value={props.newIngredient.name} onChange={(event) => props.onNewIngredient({ ...props.newIngredient, name: event.target.value })} sx={{ flex: 1 }} />
          <FormControl sx={{ minWidth: 150 }}>
            <InputLabel>Unidad</InputLabel>
            <Select
              label="Unidad"
              value={props.newIngredient.default_unit}
              onChange={(event) => props.onNewIngredient({ ...props.newIngredient, default_unit: event.target.value as RecipeUnit })}
            >
              {UNIT_OPTIONS.map((unit) => (
                <MenuItem key={unit} value={unit}>{unit}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField label="Precio ref." type="number" value={props.newIngredient.price} onChange={(event) => props.onNewIngredient({ ...props.newIngredient, price: event.target.value })} />
          <TextField label="Fuente" value={props.newIngredient.source} onChange={(event) => props.onNewIngredient({ ...props.newIngredient, source: event.target.value })} />
          <Button variant="contained" startIcon={<Add />} onClick={props.onAddIngredient}>Crear</Button>
        </Stack>
      </Paper>
      {props.ingredients.map((ingredient) => (
        <IngredientRow key={ingredient.id} ingredient={ingredient} onSave={props.onSaveIngredient} />
      ))}
    </Stack>
  );
}

function IngredientRow(props: { ingredient: Ingredient; onSave: (ingredient: Ingredient) => void }) {
  const [draft, setDraft] = useState(props.ingredient);
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems="center">
        <TextField label="Nombre" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} sx={{ flex: 1 }} />
        <FormControl sx={{ minWidth: 150 }}>
          <InputLabel>Unidad</InputLabel>
          <Select
            label="Unidad"
            value={draft.default_unit ?? "unit"}
            onChange={(event) => setDraft({ ...draft, default_unit: event.target.value as RecipeUnit })}
          >
            {UNIT_OPTIONS.map((unit) => (
              <MenuItem key={unit} value={unit}>{unit}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <Typography variant="body2" color="text.secondary" sx={{ minWidth: 180 }}>
          Ref: {ingredientPriceLabel(draft)}
        </Typography>
        <Button onClick={() => props.onSave(draft)}>Guardar</Button>
      </Stack>
    </Paper>
  );
}

function ingredientPriceLabel(ingredient: Ingredient) {
  if (!ingredient.latest_price) return "Sin precio";
  return `${money(ingredient.latest_price.price)} por ${ingredient.latest_price.quantity} ${ingredient.latest_price.unit}`;
}

function WeekTab(props: {
  recipes: RecipeSummary[];
  mealPlan: MealPlanEntry[];
  onAdd: (weekday: number, recipeId: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(7, minmax(0, 1fr))" }, gap: 1.5 }}>
      {weekdays.map((day, weekday) => (
        <Paper key={day} variant="outlined" sx={{ p: 1.5, minHeight: 260 }}>
          <Typography fontWeight={900} sx={{ mb: 1 }}>
            {day}
          </Typography>
          <FormControl fullWidth size="small" sx={{ mb: 1.5 }}>
            <InputLabel>Agregar</InputLabel>
            <Select
              label="Agregar"
              value=""
              onChange={(event) => {
                if (event.target.value) props.onAdd(weekday, event.target.value);
              }}
            >
              {props.recipes.map((recipe) => (
                <MenuItem key={recipe.id} value={recipe.id}>
                  {recipe.title}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Stack spacing={1}>
            {props.mealPlan
              .filter((entry) => entry.weekday === weekday)
              .sort((a, b) => a.position - b.position)
              .map((entry) => (
                <Paper key={entry.id} variant="outlined" sx={{ p: 1, bgcolor: "rgba(72, 98, 76, 0.06)" }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Box sx={{ flex: 1 }}>
                      <Typography fontWeight={800}>{entry.recipe.title}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {entry.recipe.category_name ?? "Sin categoria"}
                      </Typography>
                    </Box>
                    <IconButton size="small" onClick={() => props.onRemove(entry.id)}>
                      <DeleteOutline fontSize="small" />
                    </IconButton>
                  </Stack>
                </Paper>
              ))}
          </Stack>
        </Paper>
      ))}
    </Box>
  );
}
