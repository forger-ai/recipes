import { del, get, post, request } from "./client";

export type Category = {
  id: string;
  name: string;
  color: string;
};

export type PriceObservation = {
  id: string;
  ingredient_id: string;
  price: number;
  quantity: number;
  unit: string;
  source?: string | null;
  observed_at: string;
};

export type Ingredient = {
  id: string;
  name: string;
  default_unit?: string | null;
  notes?: string | null;
  latest_price?: PriceObservation | null;
};

export type RecipeIngredient = {
  id?: string;
  ingredient_id?: string | null;
  name: string;
  quantity?: number | null;
  unit?: string | null;
  note?: string | null;
  position: number;
  estimated_cost?: number | null;
};

export type RecipeStep = {
  id?: string;
  text: string;
  position: number;
};

export type RecipeSummary = {
  id: string;
  title: string;
  description?: string | null;
  category_id?: string | null;
  category_name?: string | null;
  favorite: boolean;
  rating?: number | null;
  servings: number;
  image_ref?: string | null;
  estimated_cost?: number | null;
  estimated_cost_per_serving?: number | null;
  created_at: string;
  updated_at: string;
};

export type Recipe = RecipeSummary & {
  user_note?: string | null;
  prep_minutes?: number | null;
  cook_minutes?: number | null;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
};

export type RecipePayload = {
  title: string;
  description?: string | null;
  category_id?: string | null;
  favorite: boolean;
  rating?: number | null;
  user_note?: string | null;
  servings: number;
  prep_minutes?: number | null;
  cook_minutes?: number | null;
  image_ref?: string | null;
  ingredients: Omit<RecipeIngredient, "id" | "estimated_cost">[];
  steps: Omit<RecipeStep, "id">[];
};

export function listRecipes(params: {
  q?: string;
  favorite?: boolean;
  category_id?: string;
}) {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.favorite !== undefined) query.set("favorite", String(params.favorite));
  if (params.category_id) query.set("category_id", params.category_id);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return get<RecipeSummary[]>(`/api/recipes${suffix}`);
}

export function getRecipe(id: string) {
  return get<Recipe>(`/api/recipes/${id}`);
}

export function createRecipe(payload: RecipePayload) {
  return post<Recipe>("/api/recipes", payload);
}

export function updateRecipe(id: string, payload: RecipePayload) {
  return request<Recipe>(`/api/recipes/${id}`, { method: "PUT", body: payload });
}

export function deleteRecipe(id: string) {
  return del<{ status: string }>(`/api/recipes/${id}`);
}

export function listCategories() {
  return get<Category[]>("/api/categories");
}

export function createCategory(payload: { name: string; color: string }) {
  return post<Category>("/api/categories", payload);
}

export function listIngredients() {
  return get<Ingredient[]>("/api/ingredients");
}

export function createIngredient(payload: {
  name: string;
  default_unit?: string | null;
  notes?: string | null;
}) {
  return post<Ingredient>("/api/ingredients", payload);
}

export function addIngredientPrice(
  ingredientId: string,
  payload: { price: number; quantity: number; unit: string; source?: string | null },
) {
  return post<PriceObservation>(`/api/ingredients/${ingredientId}/prices`, payload);
}
