/* eslint-disable prettier/prettier */
import { PartialType } from '@nestjs/swagger';
import { CreateInfirmierDto } from './create-infirmier.dto';

export class UpdateInfirmierDto extends PartialType(CreateInfirmierDto) {}