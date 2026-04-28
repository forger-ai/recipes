import { useEffect, useMemo, useState } from "react";
import {
  Add,
  DeleteOutline,
  Favorite,
  FavoriteBorder,
  Restaurant,
  Save,
  Search,
  Star,
} from "@mui/icons-material";
import {
  Alert,
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
  Select,
  Stack,
  Switch,
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
  listRecipes,
  Recipe,
  RecipeIngredient,
  RecipePayload,
  RecipeStep,
  RecipeSummary,
  updateRecipe,
} from "./api/recipes";

type Draft = RecipePayload;

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

const colors = ["#48624c", "#b75d46", "#bd7b32", "#5f6f91", "#8a5a72"];

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
  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [search, setSearch] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState("");
  const [newIngredient, setNewIngredient] = useState({
    name: "",
    default_unit: "unit",
    price: "",
    source: "",
  });

  const selectedSummary = useMemo(
    () => recipes.find((recipe) => recipe.id === selectedId),
    [recipes, selectedId],
  );

  async function loadAll(nextSelectedId = selectedId) {
    setLoading(true);
    setError(null);
    try {
      const [recipeRows, categoryRows, ingredientRows] = await Promise.all([
        listRecipes({ q: search, favorite: favoritesOnly || undefined }),
        listCategories(),
        listIngredients(),
      ]);
      setRecipes(recipeRows);
      setCategories(categoryRows);
      setIngredients(ingredientRows);
      if (nextSelectedId) {
        const recipe = await getRecipe(nextSelectedId);
        setSelectedId(recipe.id);
        setSelectedRecipe(recipe);
        setDraft(recipeToDraft(recipe));
      } else if (recipeRows.length > 0) {
        const recipe = await getRecipe(recipeRows[0].id);
        setSelectedId(recipe.id);
        setSelectedRecipe(recipe);
        setDraft(recipeToDraft(recipe));
      } else {
        setSelectedId(null);
        setSelectedRecipe(null);
        setDraft(emptyDraft());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar Recipes");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function selectRecipe(id: string) {
    setError(null);
    try {
      const recipe = await getRecipe(id);
      setSelectedId(id);
      setSelectedRecipe(recipe);
      setDraft(recipeToDraft(recipe));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo abrir la receta");
    }
  }

  function newRecipe() {
    setSelectedId(null);
    setSelectedRecipe(null);
    setDraft(emptyDraft());
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
        ingredients: draft.ingredients.map((item, index) => ({
          ...item,
          name: item.name.trim(),
          position: index,
        })),
        steps: draft.steps
          .filter((step) => step.text.trim())
          .map((step, index) => ({ text: step.text.trim(), position: index })),
      };
      const saved = selectedId
        ? await updateRecipe(selectedId, payload)
        : await createRecipe(payload);
      await loadAll(saved.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la receta");
    } finally {
      setSaving(false);
    }
  }

  async function removeRecipe() {
    if (!selectedId || !window.confirm("Eliminar esta receta?")) return;
    setSaving(true);
    try {
      await deleteRecipe(selectedId);
      await loadAll(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar la receta");
    } finally {
      setSaving(false);
    }
  }

  async function addCategory() {
    if (!newCategory.trim()) return;
    const color = colors[categories.length % colors.length];
    const category = await createCategory({ name: newCategory.trim(), color });
    setCategories((current) => [...current, category]);
    setDraft((current) => ({ ...current, category_id: category.id }));
    setNewCategory("");
  }

  async function addIngredientToCatalog() {
    if (!newIngredient.name.trim()) return;
    const ingredient = await createIngredient({
      name: newIngredient.name.trim(),
      default_unit: newIngredient.default_unit || null,
    });
    if (newIngredient.price) {
      await addIngredientPrice(ingredient.id, {
        price: Number(newIngredient.price),
        quantity: 1,
        unit: newIngredient.default_unit || "unit",
        source: newIngredient.source || null,
      });
    }
    const ingredientRows = await listIngredients();
    setIngredients(ingredientRows);
    setNewIngredient({ name: "", default_unit: "unit", price: "", source: "" });
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

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <Box
        sx={{
          borderBottom: "1px solid",
          borderColor: "rgba(72, 98, 76, 0.18)",
          bgcolor: "background.paper",
        }}
      >
        <Box
          sx={{
            maxWidth: 1440,
            mx: "auto",
            px: { xs: 2, md: 3 },
            py: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 2,
          }}
        >
          <Stack direction="row" spacing={1.5} alignItems="center">
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
            <Box>
              <Typography variant="h5" fontWeight={800}>
                Recipes
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Recetas locales con costos observados
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button startIcon={<Add />} variant="outlined" onClick={newRecipe}>
              Nueva
            </Button>
            <Button
              startIcon={saving ? <CircularProgress size={16} /> : <Save />}
              variant="contained"
              onClick={saveRecipe}
              disabled={saving}
            >
              Guardar
            </Button>
          </Stack>
        </Box>
      </Box>

      <Box
        sx={{
          maxWidth: 1440,
          mx: "auto",
          p: { xs: 2, md: 3 },
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "320px minmax(0, 1fr) 340px" },
          gap: 2,
          alignItems: "start",
        }}
      >
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={2}>
            <TextField
              size="small"
              label="Buscar"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void loadAll(null);
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography variant="body2">Solo favoritas</Typography>
              <Switch
                checked={favoritesOnly}
                onChange={(event) => {
                  setFavoritesOnly(event.target.checked);
                  setTimeout(() => void loadAll(null), 0);
                }}
              />
            </Stack>
            <Divider />
            {loading ? (
              <Stack alignItems="center" sx={{ py: 4 }}>
                <CircularProgress size={24} />
              </Stack>
            ) : recipes.length === 0 ? (
              <Alert severity="info">Crea la primera receta para empezar.</Alert>
            ) : (
              <Stack spacing={1}>
                {recipes.map((recipe) => (
                  <Paper
                    key={recipe.id}
                    variant="outlined"
                    onClick={() => void selectRecipe(recipe.id)}
                    sx={{
                      p: 1.5,
                      cursor: "pointer",
                      borderColor:
                        recipe.id === selectedId ? "primary.main" : "divider",
                      bgcolor:
                        recipe.id === selectedId
                          ? "rgba(72, 98, 76, 0.08)"
                          : "background.paper",
                    }}
                  >
                    <Stack spacing={1}>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Typography fontWeight={800} sx={{ flex: 1 }}>
                          {recipe.title}
                        </Typography>
                        {recipe.favorite && <Favorite color="secondary" fontSize="small" />}
                      </Stack>
                      <Stack direction="row" spacing={0.75} flexWrap="wrap">
                        {recipe.category_name && (
                          <Chip size="small" label={recipe.category_name} />
                        )}
                        {recipe.rating && (
                          <Chip
                            size="small"
                            icon={<Star fontSize="small" />}
                            label={recipe.rating}
                          />
                        )}
                        <Chip size="small" label={money(recipe.estimated_cost)} />
                      </Stack>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            )}
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={2}>
            {error && <Alert severity="error">{error}</Alert>}
            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
              <TextField
                label="Titulo"
                value={draft.title}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, title: event.target.value }))
                }
                fullWidth
              />
              <FormControl sx={{ minWidth: 180 }}>
                <InputLabel>Categoria</InputLabel>
                <Select
                  label="Categoria"
                  value={draft.category_id ?? ""}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      category_id: event.target.value || null,
                    }))
                  }
                >
                  <MenuItem value="">Sin categoria</MenuItem>
                  {categories.map((category) => (
                    <MenuItem key={category.id} value={category.id}>
                      {category.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Tooltip title="Favorita">
                <IconButton
                  color={draft.favorite ? "secondary" : "default"}
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      favorite: !current.favorite,
                    }))
                  }
                >
                  {draft.favorite ? <Favorite /> : <FavoriteBorder />}
                </IconButton>
              </Tooltip>
            </Stack>

            <TextField
              label="Descripcion"
              value={draft.description ?? ""}
              onChange={(event) =>
                setDraft((current) => ({ ...current, description: event.target.value }))
              }
              multiline
              minRows={2}
            />

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "repeat(4, 1fr)" },
                gap: 1.5,
              }}
            >
              <TextField
                label="Porciones"
                type="number"
                value={draft.servings}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    servings: Math.max(1, Number(event.target.value) || 1),
                  }))
                }
              />
              <TextField
                label="Prep. min"
                type="number"
                value={draft.prep_minutes ?? ""}
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
                value={draft.cook_minutes ?? ""}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    cook_minutes: event.target.value ? Number(event.target.value) : null,
                  }))
                }
              />
              <TextField
                label="Nota 1-5"
                type="number"
                value={draft.rating ?? ""}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    rating: event.target.value ? Number(event.target.value) : null,
                  }))
                }
              />
            </Box>

            <TextField
              label="Foto o imagen"
              placeholder="Ruta local, URL o referencia generada por Forger"
              value={draft.image_ref ?? ""}
              onChange={(event) =>
                setDraft((current) => ({ ...current, image_ref: event.target.value }))
              }
            />

            <TextField
              label="Nota personal"
              value={draft.user_note ?? ""}
              onChange={(event) =>
                setDraft((current) => ({ ...current, user_note: event.target.value }))
              }
              multiline
              minRows={2}
            />

            <Divider />
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography variant="h6">Ingredientes</Typography>
                <Typography variant="body2" color="text.secondary">
                  Usa el catalogo para calcular costo cuando la unidad coincide.
                </Typography>
              </Box>
              <Button startIcon={<Add />} onClick={() => addIngredientLine()}>
                Agregar
              </Button>
            </Stack>
            <Stack spacing={1}>
              {draft.ingredients.length === 0 && (
                <Alert severity="info">Agrega ingredientes estructurados.</Alert>
              )}
              {draft.ingredients.map((item, index) => (
                <Box
                  key={index}
                  sx={{
                    display: "grid",
                    gridTemplateColumns: {
                      xs: "1fr",
                      md: "2fr 1fr 1fr auto",
                    },
                    gap: 1,
                  }}
                >
                  <TextField
                    size="small"
                    label="Ingrediente"
                    value={item.name}
                    onChange={(event) =>
                      updateIngredientLine(index, { name: event.target.value })
                    }
                  />
                  <TextField
                    size="small"
                    label="Cantidad"
                    type="number"
                    value={item.quantity ?? ""}
                    onChange={(event) =>
                      updateIngredientLine(index, {
                        quantity: event.target.value ? Number(event.target.value) : null,
                      })
                    }
                  />
                  <TextField
                    size="small"
                    label="Unidad"
                    value={item.unit ?? ""}
                    onChange={(event) =>
                      updateIngredientLine(index, { unit: event.target.value })
                    }
                  />
                  <Tooltip title="Quitar ingrediente">
                    <IconButton
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          ingredients: current.ingredients.filter(
                            (_line, lineIndex) => lineIndex !== index,
                          ),
                        }))
                      }
                    >
                      <DeleteOutline />
                    </IconButton>
                  </Tooltip>
                </Box>
              ))}
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
              {draft.steps.length === 0 && (
                <Alert severity="info">Agrega pasos ordenados para preparar la receta.</Alert>
              )}
              {draft.steps.map((step, index) => (
                <Stack key={index} direction="row" spacing={1} alignItems="flex-start">
                  <Chip label={index + 1} sx={{ mt: 1 }} />
                  <TextField
                    size="small"
                    multiline
                    fullWidth
                    minRows={2}
                    value={step.text}
                    onChange={(event) => updateStep(index, { text: event.target.value })}
                  />
                  <Tooltip title="Quitar paso">
                    <IconButton
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          steps: current.steps.filter(
                            (_line, lineIndex) => lineIndex !== index,
                          ),
                        }))
                      }
                    >
                      <DeleteOutline />
                    </IconButton>
                  </Tooltip>
                </Stack>
              ))}
            </Stack>

            {selectedRecipe && (
              <Alert severity="success">
                Costo estimado: {money(selectedSummary?.estimated_cost)} · Por porcion:{" "}
                {money(selectedSummary?.estimated_cost_per_serving)}
              </Alert>
            )}
            <Stack direction="row" spacing={1} justifyContent="space-between">
              <Button
                color="error"
                startIcon={<DeleteOutline />}
                onClick={removeRecipe}
                disabled={!selectedId || saving}
              >
                Eliminar
              </Button>
              <Button
                startIcon={saving ? <CircularProgress size={16} /> : <Save />}
                variant="contained"
                onClick={saveRecipe}
                disabled={saving}
              >
                Guardar receta
              </Button>
            </Stack>
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={2}>
            <Box>
              <Typography variant="h6">Categorias</Typography>
              <Typography variant="body2" color="text.secondary">
                Organiza recetas por tipo de comida.
              </Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              <TextField
                size="small"
                label="Nueva categoria"
                value={newCategory}
                onChange={(event) => setNewCategory(event.target.value)}
                fullWidth
              />
              <Button variant="outlined" onClick={() => void addCategory()}>
                Crear
              </Button>
            </Stack>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {categories.map((category) => (
                <Chip
                  key={category.id}
                  label={category.name}
                  sx={{
                    bgcolor: category.color,
                    color: "#fff",
                    mb: 1,
                  }}
                />
              ))}
            </Stack>

            <Divider />
            <Box>
              <Typography variant="h6">Catalogo de ingredientes</Typography>
              <Typography variant="body2" color="text.secondary">
                Registra precios observados para estimar costos.
              </Typography>
            </Box>
            <Stack spacing={1}>
              <TextField
                size="small"
                label="Ingrediente"
                value={newIngredient.name}
                onChange={(event) =>
                  setNewIngredient((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
              />
              <Stack direction="row" spacing={1}>
                <TextField
                  size="small"
                  label="Unidad"
                  value={newIngredient.default_unit}
                  onChange={(event) =>
                    setNewIngredient((current) => ({
                      ...current,
                      default_unit: event.target.value,
                    }))
                  }
                  sx={{ width: 120 }}
                />
                <TextField
                  size="small"
                  label="Precio"
                  type="number"
                  value={newIngredient.price}
                  onChange={(event) =>
                    setNewIngredient((current) => ({
                      ...current,
                      price: event.target.value,
                    }))
                  }
                  fullWidth
                />
              </Stack>
              <TextField
                size="small"
                label="Fuente"
                value={newIngredient.source}
                onChange={(event) =>
                  setNewIngredient((current) => ({
                    ...current,
                    source: event.target.value,
                  }))
                }
              />
              <Button variant="outlined" onClick={() => void addIngredientToCatalog()}>
                Guardar ingrediente
              </Button>
            </Stack>

            <Stack spacing={1}>
              {ingredients.length === 0 ? (
                <Alert severity="info">Aun no hay ingredientes en el catalogo.</Alert>
              ) : (
                ingredients.map((ingredient) => (
                  <Paper key={ingredient.id} variant="outlined" sx={{ p: 1.25 }}>
                    <Stack spacing={1}>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Typography fontWeight={800} sx={{ flex: 1 }}>
                          {ingredient.name}
                        </Typography>
                        <Tooltip title="Usar en receta">
                          <IconButton onClick={() => addIngredientLine(ingredient)}>
                            <Add />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                      <Typography variant="body2" color="text.secondary">
                        {ingredient.latest_price
                          ? `${money(ingredient.latest_price.price)} por ${ingredient.latest_price.quantity} ${ingredient.latest_price.unit}`
                          : "Sin precio observado"}
                      </Typography>
                    </Stack>
                  </Paper>
                ))
              )}
            </Stack>
          </Stack>
        </Paper>
      </Box>
    </Box>
  );
}
