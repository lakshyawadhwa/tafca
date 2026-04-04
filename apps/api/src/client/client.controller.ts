import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Query,
  Body,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ClientService } from './client.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { ListClientsQueryDto } from './dto/list-clients-query.dto';
import {
  ClientResponseDto,
  PaginatedClientsResponseDto,
  GstNumberResponseDto,
} from './dto/client-response.dto';
import { CreateGstNumberDto } from './dto/create-gst-number.dto';
import { UpdateGstNumberDto } from './dto/update-gst-number.dto';

@Controller('clients')
export class ClientController {
  constructor(private readonly clientService: ClientService) {}

  @Get()
  async listClients(
    @Query() query: ListClientsQueryDto,
  ): Promise<PaginatedClientsResponseDto> {
    return this.clientService.listClients(query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createClient(
    @Body() dto: CreateClientDto,
  ): Promise<ClientResponseDto> {
    return this.clientService.createClient(dto);
  }

  @Get(':id')
  async getClient(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ClientResponseDto> {
    return this.clientService.getClient(id);
  }

  @Patch(':id')
  async updateClient(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClientDto,
  ): Promise<ClientResponseDto> {
    return this.clientService.updateClient(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteClient(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.clientService.deleteClient(id);
  }

  // ───────────────────────── GST Number CRUD ─────────────────────────

  @Post(':id/gst-numbers')
  @HttpCode(HttpStatus.CREATED)
  async addGstNumber(
    @Param('id', ParseUUIDPipe) clientId: string,
    @Body() dto: CreateGstNumberDto,
  ): Promise<GstNumberResponseDto> {
    return this.clientService.addGstNumber(clientId, dto);
  }

  @Patch(':id/gst-numbers/:gstId')
  async updateGstNumber(
    @Param('id', ParseUUIDPipe) clientId: string,
    @Param('gstId', ParseUUIDPipe) gstId: string,
    @Body() dto: UpdateGstNumberDto,
  ): Promise<GstNumberResponseDto> {
    return this.clientService.updateGstNumber(clientId, gstId, dto);
  }

  @Delete(':id/gst-numbers/:gstId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteGstNumber(
    @Param('id', ParseUUIDPipe) clientId: string,
    @Param('gstId', ParseUUIDPipe) gstId: string,
  ): Promise<void> {
    return this.clientService.deleteGstNumber(clientId, gstId);
  }
}
