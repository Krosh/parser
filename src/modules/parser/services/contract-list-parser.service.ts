import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';
import * as https from 'https';
import { ContractInfo } from '../dto/contract-list.dto';

@Injectable()
export class ContractListParserService {
  private readonly logger = new Logger(ContractListParserService.name);
  private readonly BASE_URL =
    'https://zakupki.gov.ru/epz/contract/search/results.html';

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async fetchContractList(page: number): Promise<ContractInfo[]> {
    try {
      const httpsAgent = new https.Agent({
        minVersion: 'TLSv1.2',
        ciphers: 'DEFAULT',
      });

      const response = await axios.get(this.BASE_URL, {
        params: {
          searchString: '',
          morphology: 'on',
          'search-filter': 'Дате размещения',
          savedSearchSettingsIdHidden: '',
          fz44: 'on',
          contractStageList: '',
          contractInputNameDefenseOrderNumber: '',
          contractInputNameContractNumber: '',
          contractPriceFrom: '',
          rightPriceRurFrom: '',
          priceFromUnitGWS: '',
          contractPriceTo: '',
          rightPriceRurTo: '',
          priceToUnitGWS: '',
          currencyCode: '',
          nonBudgetCodesList: '',
          budgetLevelsIdHidden: '',
          budgetLevelsIdNameHidden: '{}',
          budgetName: '',
          customerPlace: '',
          customerPlaceCodes: '',
          contractDateFrom: '',
          contractDateTo: '',
          publishDateFrom: '',
          publishDateTo: '',
          updateDateFrom: '',
          updateDateTo: '',
          placingWayList: '',
          selectedLaws: '',
          okdpIds: '',
          okdpIdsCodes: '',
          okpdIds: '',
          okpdIdsCodes: '',
          okpd2Ids: '',
          okpd2IdsCodes: '',
          ktruCodeNameList:
            '26.60.12.132-00000036&&&Система ультразвуковой визуализации универсальная, с питанием от сети',
          ktruSelectedChcs: '',
          ktruSelectedChcsNames: '',
          ktruSelectedCharItemVersionIdList: '',
          ktruSelectedRubricatorIdList: '',
          ktruSelectedRubricatorName: '',
          clItemsHiddenId: '',
          clGroupHiddenId: '',
          ktruSelectedPageNum: '',
          goodsCountStart: '',
          goodsCountEnd: '',
          unitPriceStart: '',
          unitPriceEnd: '',
          totalProductsPriceByCodeStart: '',
          totalProductsPriceByCodeEnd: '',
          sortBy: 'PUBLISH_DATE',
          pageNumber: page,
          sortDirection: 'false',
          recordsPerPage: '_50',
          showLotsInfoHidden: 'false',
        },
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
          'Accept-Language': 'en-US,en;q=0.9,ru;q=0.8',
          Connection: 'keep-alive',
        },
        httpsAgent,
      });

      const $ = cheerio.load(response.data);
      const contracts: ContractInfo[] = [];

      $('div.search-registry-entry-block').each((_i, el) => {
        const reestrNumberEl = $(el).find(
          'div.registry-entry__header-mid__number a',
        );
        const href = reestrNumberEl.attr('href');

        if (!href) return;

        const urlParams = new URLSearchParams(href.split('?')[1]);
        const reestrNumber = urlParams.get('reestrNumber');

        const signDate = $(el)
          .find("div.data-block__title:contains('Заключение контракта')")
          .next('div.data-block__value')
          .text()
          .trim();
        const customer = $(el)
          .find('div.registry-entry__body-href a')
          .text()
          .trim();

        if (reestrNumber) {
          contracts.push({
            reestrNumber,
            signDate,
            customer,
            detailLink: reestrNumberEl.attr('href') || '',
          });
        }
      });

      // Respect the rate limit
      await this.delay(2000);

      this.logger.log(
        `Fetched ${contracts.length} contracts from page ${page}`,
      );
      return contracts;
    } catch (error) {
      this.logger.error(
        `Error fetching contract list for page ${page}:`,
        error,
      );
      return [];
    }
  }

  async fetchMultiplePages(
    startPage: number,
    endPage: number,
  ): Promise<ContractInfo[]> {
    const allContracts: ContractInfo[] = [];

    for (let page = startPage; page <= endPage; page++) {
      try {
        const contracts = await this.fetchContractList(page);

        allContracts.push(...contracts);
        this.logger.log(
          `Processed page ${page}, total contracts: ${allContracts.length}`,
        );
      } catch (error) {
        this.logger.error(`Failed to process page ${page}: ${error.message}`);
      }
    }

    return allContracts;
  }
}
