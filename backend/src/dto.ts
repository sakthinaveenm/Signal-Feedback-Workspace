import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUrl, IsUUID, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { PLATFORMS, PRIORITIES, SOURCES, STATUSES, TYPES } from './models';
const Trim = () => Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value);
// Undefined is optional; explicit null is invalid (avoids nullifying persisted fields).
const Optional = () => ValidateIf((_, value) => value !== undefined);
export class CreateProjectDto {
  @Trim() @IsString() @IsNotEmpty() @MaxLength(120) name!: string;
  @Optional() @ValidateIf((_, value) => value !== '') @IsUrl({ protocols: ['http', 'https'], require_protocol: true }) @MaxLength(1000) url?: string;
  @IsIn(PLATFORMS) platform!: string;
}
export class UpdateProjectDto {
  @Optional() @Trim() @IsString() @IsNotEmpty() @MaxLength(120) name?: string;
  @Optional() @ValidateIf((_, value) => value !== '') @IsUrl({ protocols: ['http', 'https'], require_protocol: true }) @MaxLength(1000) url?: string;
  @Optional() @IsIn(PLATFORMS) platform?: string;
  @Optional() @IsBoolean() archived?: boolean;
}
export class SubmitFeedbackDto {
  @Trim() @IsString() @IsNotEmpty() @MaxLength(200) title!: string;
  @Optional() @IsString() @MaxLength(10000) description?: string;
  @IsIn(TYPES) type!: string;
  @IsIn(SOURCES) source!: string;
  @Optional() @IsString() @MaxLength(300) contact?: string;
}
export class CreateFeedbackDto extends SubmitFeedbackDto {
  @IsUUID('4') projectId!: string;
  @Optional() @IsIn(PRIORITIES) priority?: string;
}
export class UpdateFeedbackDto {
  @Optional() @IsIn(STATUSES) status?: string;
  @Optional() @IsIn(PRIORITIES) priority?: string;
  @Optional() @IsString() @MaxLength(10000) notes?: string;
}
export class FeedbackFilterDto {
  @Optional() @IsUUID('4') projectId?: string;
  @Optional() @IsIn(STATUSES) status?: string;
  @Optional() @IsIn(PRIORITIES) priority?: string;
  @Optional() @IsIn(TYPES) type?: string;
  @Optional() @IsIn(SOURCES) source?: string;
  @Optional() @IsString() @MaxLength(200) search?: string;
}
export class ListFeedbackDto extends FeedbackFilterDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 25;
}
