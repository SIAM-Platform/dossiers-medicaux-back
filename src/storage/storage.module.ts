import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ADAPTER_IMPORTS, StorageJournal } from './storage.adapter';
import { StorageController } from './storage.controller';
import { StorageService } from './storage.service';
import { StoredFile } from './stored-file.entity';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([StoredFile]), ...ADAPTER_IMPORTS],
  controllers: [StorageController],
  providers: [StorageService, StorageJournal],
  exports: [StorageService],
})
export class StorageModule {}
