import { Request, Response } from "express";
import BaseController from "src/controllers/BaseController";
import { prisma } from "src/db";
import Resource from "src/resources";
import { validate } from "src/utils/validator";

enum SearchResultType {
     ARTISAN = "ARTISAN",
     CURATOR = "CURATOR",
}

export default class SearchController extends BaseController {
     /**
      * GET /api/search
      * 
      * Note: Pagination is applied to each entity type separately,
      * so results may contain up to (limit * 2) items.
      */
     index = async (req: Request, res: Response) => {
          try {
               const { query } = validate(req.query, {
                    query: "nullable|string|min:2",
               });

               const { take, skip, meta } = this.pagination(req);

               const searchFilter = query
                    ? {
                         contains: query,
                         mode: "insensitive" as const,
                    }
                    : undefined;

               const whereArtisan = {
                    isActive: true,
                    OR: query
                         ? [
                              { name: searchFilter },
                              { description: searchFilter },
                              { category: { name: searchFilter } },
                         ]
                         : undefined,
               };

               const whereCurator = {
                    isActive: true,
                    OR: query
                         ? [
                              { firstName: searchFilter },
                              { lastName: searchFilter },
                              { bio: searchFilter },
                         ]
                         : undefined,
               };

               const [artisans, curators, artisanCount, curatorCount] = await Promise.all([
                    prisma.artisan.findMany({
                         where: whereArtisan,
                         take,
                         skip,
                         include: { category: true },
                    }),
                    prisma.curator.findMany({
                         where: whereCurator,
                         take,
                         skip,
                    }),
                    prisma.artisan.count({ where: whereArtisan }),
                    prisma.curator.count({ where: whereCurator }),
               ]);

               const formattedResults = [
                    ...artisans.map(a => ({
                         ...a,
                         resultType: SearchResultType.ARTISAN as const,
                    })),
                    ...curators.map(c => ({
                         ...c,
                         resultType: SearchResultType.CURATOR as const,
                    })),
               ];

               return Resource(req, res, { data: formattedResults })
                    .json()
                    .status(200)
                    .additional({
                         status: "success",
                         message: "OK",
                         code: 200,
                         pagination: meta(artisanCount + curatorCount, formattedResults.length),
                         counts: {
                              artisans: artisanCount,
                              curators: curatorCount,
                         },
                    });
          } catch (error) {
               throw error;
          }
     };

     /**
      * GET /api/search/suggestions
      */
     suggestions = async (req: Request, res: Response) => {
          try {
               const { query } = validate(req.query, {
                    query: "required|string|min:2",
               });

               const [artisanSuggestions, curatorSuggestions] = await Promise.all([
                    prisma.artisan.findMany({
                         where: {
                              isActive: true,
                              name: { contains: query, mode: "insensitive" as const },
                         },
                         select: { name: true },
                         take: 5,
                    }),

                    prisma.curator.findMany({
                         where: {
                              isActive: true,
                              OR: [
                                   { firstName: { contains: query, mode: "insensitive" as const } },
                                   { lastName: { contains: query, mode: "insensitive" as const } },
                              ],
                         },
                         select: { firstName: true, lastName: true },
                         take: 5,
                    }),
               ]);

               const suggestions = [
                    ...artisanSuggestions.map(a => ({
                         label: a.name,
                         type: SearchResultType.ARTISAN as const,
                    })),
                    ...curatorSuggestions.map(c => ({
                         label: `${c.firstName} ${c.lastName}`,
                         type: SearchResultType.CURATOR as const,
                    })),
               ];

               return Resource(req, res, { data: suggestions })
                    .json()
                    .status(200)
                    .additional({
                         status: "success",
                         message: "OK",
                         code: 200,
                    });
          } catch (error) {
               throw error;
          }
     };
}