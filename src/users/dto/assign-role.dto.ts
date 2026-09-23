/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable prettier/prettier */
import { IsArray, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class AssignRoleDto {
  @IsNotEmpty()
  @IsNumber()
  userId!: number;

  @IsArray()
  @IsString({ each: true })
  roleNames!: string[];
}