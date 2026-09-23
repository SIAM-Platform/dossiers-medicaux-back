/* eslint-disable prettier/prettier */
import { PartialType } from '@nestjs/swagger';
import { CreateMarinDto } from './create-marin.dto';

export class UpdateMarinDto extends PartialType(CreateMarinDto) {}