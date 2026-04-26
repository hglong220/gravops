export type ImageSource =
  | 'main_dom'
  | 'main_script'
  | 'detail_html'
  | 'detail_dom'
  | 'network_fallback';

export type ImageRecord = {
  url: string;
  source: ImageSource;
  width?: number;
  height?: number;
  captureId: string;
  productId: string;
  skuId?: string;
  keepReason?: string;
};

export type CollectDebugInfo = {
  captureId: string;
  productId: string;
  skuId?: string;
  pageUrl: string;
  mainImageCount: number;
  detailHtmlImageCount: number;
  detailDomImageCount: number;
  networkFallbackImageCount: number;
  finalDetailImageCount: number;
  filteredImageCount: number;
  imageDecisions: Array<{
    url: string;
    source: ImageSource;
    keep: boolean;
    reason: string;
    width?: number;
    height?: number;
    captureId: string;
    productId: string;
  }>;
};

export type JdImageCollectResult = {
  captureId: string;
  productId: string;
  skuId?: string;
  pageUrl: string;
  title: string;
  mainImages: ImageRecord[];
  detailImages: ImageRecord[];
  warnings: string[];
  errors: string[];
  debug?: CollectDebugInfo;
};

export type ImageFilterDecision = {
  keep: boolean;
  reason: string;
};

export type ProductConsistencyInput = {
  captureId: string;
  expectedProductId: string;
  currentProductId: string;
  expectedSkuId?: string;
  currentSkuId?: string;
  expectedTitle?: string;
  currentTitle?: string;
  expectedModel?: string;
  detailText?: string;
};
