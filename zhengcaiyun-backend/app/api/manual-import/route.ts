import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getActorFromRequest } from "@/lib/request-actor";

type ManualPayload = {
  originalUrl: string;
  title?: string;
  images?: string[];
  attributes?: Record<string, any>;
  skuData?: any;
  detailHtml?: string;
  categoryId?: string | null;
  brand?: string | null;
  model?: string | null;
};

export async function POST(req: NextRequest) {
  try {
    const actor = await getActorFromRequest(req);
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = actor.kind === "user" ? actor.userId : actor.userId;
    if (!userId) {
      return NextResponse.json(
        { error: "License is not linked to a user", code: "LICENSE_NOT_LINKED" },
        { status: 403 }
      );
    }

    const body = (await req.json()) as ManualPayload;
    const {
      originalUrl,
      title,
      images = [],
      attributes = {},
      skuData = {},
      detailHtml = "",
      categoryId = null,
      brand = null,
      model = null
    } = body;

    if (!originalUrl) {
      return NextResponse.json({ error: "缺少 originalUrl" }, { status: 400 });
    }

    const draft = await prisma.productDraft.create({
      data: {
        userId,
        originalUrl,
        originalId: null,
        shopName: "Unknown",
        title: title || "Untitled",
        categoryPath: null,
        categoryId,
        brand,
        model,
        images: JSON.stringify(images || []),
        attributes: JSON.stringify(attributes || {}),
        skuData: JSON.stringify(skuData || {}),
        detailHtml: detailHtml || "",
        status: "scraped",
        publishUrl: null
      }
    });

    return NextResponse.json({ success: true, draft });
  } catch (e) {
    console.error("manual-import error", e);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}
