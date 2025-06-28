import { pick } from 'lodash';
import { Request, Response, NextFunction } from 'express';

export const getLeanResponse = <T extends object>(
  data: T | T[],
  fields: (keyof T)[],
): Partial<T> | Partial<T>[] => {
  if (Array.isArray(data)) {
    return data.map((item) => pick(item, fields));
  }
  return pick(data, fields);
};

export const leanMiddleware = <T extends object>(
  defaultFields: (keyof T)[] = [],
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const fields = req.query.fields
      ? ((req.query.fields as string).split(',') as (keyof T)[])
      : defaultFields;
    res.locals.getLeanResponse = (data: T | T[]) =>
      getLeanResponse(data, fields);
    next();
  };
};
