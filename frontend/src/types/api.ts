export interface ImportErrorItem {
  rowNumber: number;
  field: string | null;
  message: string;
}

export interface AuthUser {
  id: number;
  login: string;
  displayName: string;
}

export interface AuthResponse {
  user: AuthUser;
}

export interface ImportResponse {
  importBatchId: string;
  status: "completed" | "completed_with_errors" | "failed";
  summary: {
    totalRows: number;
    importedRows: number;
    skippedRows: number;
  };
  errors: ImportErrorItem[];
}

export interface ImportBatchListItem {
  id: string;
  filename: string;
  status: "completed" | "completed_with_errors" | "failed";
  total_rows: number;
  imported_rows: number;
  skipped_rows: number;
  created_at: string;
}

export interface ImportBatchesResponse {
  items: ImportBatchListItem[];
}

export interface ClearImportsResponse {
  message: string;
  importBatchesDeleted: number;
  importErrorsDeleted: number;
  vehicleOffersDeleted: number;
}

export interface CatalogItem {
  id: number;
  importBatchId: string;
  offerCode: string;
  status: string;
  brand: string;
  model: string;
  modification: string;
  vehicleType: string;
  year: number;
  mileageKm: number;
  keyCount: number;
  ptsType: string;
  hasEncumbrance: boolean;
  isDeregistered: boolean;
  responsiblePerson: string;
  storageAddress: string;
  daysOnSale: number;
  price: number;
  yandexDiskUrl: string;
  bookingStatus: string;
  externalId: string;
  crmRef: string;
  websiteUrl: string;
  title: string;
  createdAt: string;
}

export interface CatalogItemsResponse {
  items: CatalogItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  };
}

export interface CatalogFiltersResponse {
  offerCode: string[];
  status: string[];
  city: string[];
  brand: string[];
  model: string[];
  modification: string[];
  vehicleType: string[];
  ptsType: string[];
  hasEncumbrance: boolean[];
  isDeregistered: boolean[];
  responsiblePerson: string[];
  storageAddress: string[];
  bookingStatus: string[];
  externalId: string[];
  crmRef: string[];
  websiteUrl: string[];
  yandexDiskUrl: string[];
  modelsByBrand?: Record<string, string[]>;
  priceMin: number | null;
  priceMax: number | null;
  yearMin: number | null;
  yearMax: number | null;
  mileageMin: number | null;
  mileageMax: number | null;
  keyCountMin: number | null;
  keyCountMax: number | null;
  daysOnSaleMin: number | null;
  daysOnSaleMax: number | null;
}
