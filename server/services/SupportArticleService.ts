import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export class SupportArticleService {
  async searchArticles(query: string, category?: string) {
    const whereClause: any = {
      isPublished: true,
    };

    if (category) {
      whereClause.category = category;
    }

    if (query) {
      whereClause.OR = [
        { title: { contains: query, mode: "insensitive" } },
        { content: { contains: query, mode: "insensitive" } },
      ];
    }

    return await prisma.supportArticle.findMany({
      where: whereClause,
      orderBy: [
        { viewCount: "desc" },
        { helpfulCount: "desc" },
      ],
      take: 20,
    });
  }

  async getArticleBySlug(slug: string) {
    const article = await prisma.supportArticle.findUnique({
      where: { slug },
    });

    if (!article) {
      throw new Error("Article not found");
    }

    await prisma.supportArticle.update({
      where: { id: article.id },
      data: { viewCount: { increment: 1 } },
    });

    return article;
  }

  async getArticlesByCategory(category: string) {
    return await prisma.supportArticle.findMany({
      where: {
        category,
        isPublished: true,
      },
      orderBy: { viewCount: "desc" },
    });
  }

  async getRelatedArticles(articleId: string, limit = 5) {
    const article = await prisma.supportArticle.findUnique({
      where: { id: articleId },
    });

    if (!article) {
      return [];
    }

    return await prisma.supportArticle.findMany({
      where: {
        category: article.category,
        id: { not: articleId },
        isPublished: true,
      },
      orderBy: { viewCount: "desc" },
      take: limit,
    });
  }

  async markHelpful(articleId: string) {
    return await prisma.supportArticle.update({
      where: { id: articleId },
      data: { helpfulCount: { increment: 1 } },
    });
  }

  async getAllCategories() {
    const articles = await prisma.supportArticle.findMany({
      where: { isPublished: true },
      select: { category: true },
      distinct: ["category"],
    });

    return articles.map(a => a.category);
  }
}

export const supportArticleService = new SupportArticleService();
