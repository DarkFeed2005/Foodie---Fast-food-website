import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  success: boolean;
  statusCode: number;
  message: string;
  data: T;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((payload) => {
        const response = context.switchToHttp().getResponse();
        let message = 'Request successful';
        let data: any = payload;

        if (payload !== null && typeof payload === 'object' && 'message' in payload) {
          message = payload.message;
          const rest = { ...payload };
          delete rest.message;
          data = Object.keys(rest).length > 0 ? rest : null;
        }

        return {
          success: true,
          statusCode: response.statusCode,
          message,
          data,
        };
      }),
    );
  }
}
