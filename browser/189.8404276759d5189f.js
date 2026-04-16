'use strict';
(self.webpackChunklegispan_frontend = self.webpackChunklegispan_frontend || []).push([
  [189],
  {
    804: (C, f, r) => {
      (r.r(f), r.d(f, { PublicSearchModule: () => b }));
      var v = r(6895),
        m = r(4966),
        y = r(7146),
        u = r(1602),
        E = r(2341),
        h = r(2674),
        p = r(1923),
        F = r(8658),
        T = r(7490),
        O = r(1850),
        A = r(4282),
        w = r(1479),
        x = r(7170),
        l = r(5861),
        d = r(2402),
        D = r(4641),
        N = r.n(D),
        a = r(4650),
        M = r(2361),
        Q = r(4263),
        Z = r(9433),
        L = r(1866),
        U = r(2338),
        Y = r(2906),
        R = r(9002),
        B = r(2371),
        $ = r(8127),
        K = r(8312),
        W = r(9287),
        J = r(1716),
        k = r(2784),
        z = r(2004),
        G = r(1586),
        V = r(903),
        H = r(2979),
        j = r(5780),
        X = r(5730),
        q = r(4064);
      const _ = ['searchFormTemplate'],
        ee = ['filterFormTemplate'],
        te = function (re) {
          return { show: re };
        };
      class S {
        router;
        route;
        ability;
        pdfSvc;
        affidavitService;
        authService;
        candidatesService;
        postulationService;
        exportService;
        provinceService;
        districtService;
        townshipService;
        circuitsService;
        eventsService;
        positionsService;
        partiesService;
        publicSearchService;
        tabService;
        childNavigationService;
        ubicationBehaviorService;
        eventsCategoriesService;
        periodService;
        searchFormId;
        filterFormId;
        userCanUpdate = !1;
        userCanCreate = !1;
        showExportationModal = !1;
        showDeletionModal = !1;
        showFiltersModal = !1;
        isFormLoaded = !1;
        candidateId = '';
        affidavitId = null;
        filterFormData = this.initFilterForm();
        filterInputsIndex = {
          STATUS: 0,
          CANDIDATE: 1,
          EVENT: 2,
          PERIOD: 3,
          POSITION: 4,
          PARTY: 5,
          MONTH: 6,
          PROVINCE: 7,
          DISTRICT: 8,
          TOWNSHIP: 9,
          CIRCUIT: 10,
        };
        searchForm = [
          {
            controlType: 'textBox',
            key: 'query',
            type: 'text',
            value: '',
            label: '',
            required: !1,
            width: 'xl',
            noMargin: !0,
            showInnerIcon: !0,
            icon: '../assets/icons/search.svg',
            position: 'center',
            isSingleRow: !0,
            placeholder: 'Escriba su b\xfasqueda',
          },
        ];
        filterForm = [
          new d.SU({
            controlType: 'dropdownWithSearch',
            key: 'status',
            value: '',
            label: 'Estatus',
            width: 'sm',
            selectOptions: [
              { label: 'Evaluado', value: 'audited' },
              { label: 'En Evaluaci\xf3n', value: 'inAudit' },
              { label: 'Extempor\xe1neo', value: 'extemporary' },
              { label: 'Presentado', value: 'sent' },
            ],
          }),
          new d.SU({
            controlType: 'dropdownWithSearch',
            key: 'candidateId',
            value: '',
            label: 'Candidato',
            width: 'sm',
            selectOptions: [],
          }),
          new d.SU({
            controlType: 'dropdownWithSearch',
            key: 'eventCategoryId',
            value: '',
            label: 'Categor\xeda del Evento',
            width: 'sm',
            selectOptions: [],
          }),
          new d.SU({
            controlType: 'dropdownWithSearch',
            key: 'periodId',
            value: '',
            label: 'Periodo',
            width: 'sm',
            selectOptions: [],
          }),
          new d.SU({
            controlType: 'dropdownWithSearch',
            key: 'positionId',
            value: '',
            label: 'Cargo',
            width: 'sm',
            selectOptions: [],
          }),
          new d.SU({
            controlType: 'dropdownWithSearch',
            key: 'partyId',
            value: '',
            label: 'Partido/Libre postulaci\xf3n',
            width: 'sm',
            selectOptions: [],
          }),
          new d.SU({
            controlType: 'dropdownWithSearch',
            key: 'month',
            value: '',
            label: 'Mes',
            width: 'sm',
            selectOptions: [
              { value: '1', label: 'Enero' },
              { value: '2', label: 'Febrero' },
              { value: '3', label: 'Marzo' },
              { value: '4', label: 'Abril' },
              { value: '5', label: 'Mayo' },
              { value: '6', label: 'Junio' },
              { value: '7', label: 'Julio' },
              { value: '8', label: 'Agosto' },
              { value: '9', label: 'Septiembre' },
              { value: '10', label: 'Octubre' },
              { value: '11', label: 'Noviembre' },
              { value: '12', label: 'Diciembre' },
            ],
          }),
          new d.SU({
            controlType: 'dropdownWithSearch',
            key: 'provinceId',
            value: '',
            label: 'Provincia',
            width: 'sm',
            selectOptions: [],
          }),
          new d.SU({
            controlType: 'dropdownWithSearch',
            key: 'districtId',
            value: '',
            label: 'Distrito',
            width: 'sm',
            selectOptions: [],
          }),
          new d.SU({
            controlType: 'dropdownWithSearch',
            key: 'townshipId',
            value: '',
            label: 'Corregimiento',
            width: 'sm',
            selectOptions: [],
          }),
          new d.SU({
            controlType: 'dropdownWithSearch',
            key: 'circuitId',
            value: '',
            label: 'Circuito',
            width: 'sm',
            selectOptions: [],
          }),
          new d.SU({
            controlType: 'dropdownWithSearch',
            key: 'isProclaimed',
            value: '',
            label: 'Proclamado',
            width: 'sm',
            selectOptions: [
              { value: 'false', label: 'No' },
              { value: 'true', label: 'Si' },
            ],
          }),
        ];
        searchQuery = { page: 1, limit: 10, candidateId: '' };
        tableIcons = {
          modifyIcon: '../assets/icons/edit.svg',
          deleteIcon: '../assets/icons/delete.svg',
          downloadIcon: '../assets/icons/download.svg',
          additionIcon: '../assets/icons/create.svg',
          filterIcon: '../assets/icons/filter.svg',
        };
        tableActions = {
          modifyAction: (e) => this.editAffidavit(e.id, e.statusId, e),
          filterAction: () => this.onFilterModalStatus({ isOpen: !0 }),
        };
        affidavitsTable = [];
        tableColumns = [
          { prop: 'status', name: 'Estatus' },
          { prop: 'documentId', name: 'C\xe9dula', sortable: !0 },
          { prop: 'Candidate', name: 'Candidato', sortable: !0 },
          { prop: 'event', name: 'Categor\xeda del Evento' },
          { prop: 'period', name: 'Periodo' },
          { prop: 'Position', name: 'Cargo' },
          { prop: 'Party', name: 'Partido/Libre postulaci\xf3n' },
          { prop: 'month', name: 'Mes' },
          { prop: 'Province', name: 'Ubicaci\xf3n' },
          { prop: 'isProclaimed', name: 'Proclamado', sortable: !0 },
        ];
        tablePagination = { page: 1, limit: 10, count: 0 };
        statusTranslations = {
          pending: 'Pendiente',
          sent: 'Presentado',
          sentUnsubstantiated: 'Presentado',
          approved: 'Aprobado',
          approvedUnsubstantiated: 'Aprobado sin Sustento',
          returned: 'Devuelto',
          extemporary: 'Extempor\xe1neo',
          audited: 'Evaluado',
          inAudit: 'En Evaluaci\xf3n',
        };
        isFetchingData = !0;
        isExporting = !1;
        eventData = {};
        meType = 'user';
        filterLabel = 'Filtros';
        formLoaded = !1;
        showCandidate = !1;
        monthNames = [
          'Enero',
          'Febrero',
          'Marzo',
          'Abril',
          'Mayo',
          'Junio',
          'Julio',
          'Agosto',
          'Septiembre',
          'Octubre',
          'Noviembre',
          'Diciembre',
        ];
        autoSearchEmitted = !1;
        searchOnEnterEmitted = !1;
        searchOnBlurEmtted = !1;
        enableAutoSearch = !0;
        publicSearchStorageKey = 'browser.publicSearch.state.v1';
        constructor(e, t, i, s, o, c, n, g, P, oe, se, ne, le, ce, de, ue, he, me, pe, ve, fe, ge) {
          ((this.router = e),
            (this.route = t),
            (this.ability = i),
            (this.pdfSvc = s),
            (this.affidavitService = o),
            (this.authService = c),
            (this.candidatesService = n),
            (this.postulationService = g),
            (this.exportService = P),
            (this.provinceService = oe),
            (this.districtService = se),
            (this.townshipService = ne),
            (this.circuitsService = le),
            (this.eventsService = ce),
            (this.positionsService = de),
            (this.partiesService = ue),
            (this.publicSearchService = he),
            (this.tabService = me),
            (this.childNavigationService = pe),
            (this.ubicationBehaviorService = ve),
            (this.eventsCategoriesService = fe),
            (this.periodService = ge));
        }
        getDefaultSearchQuery() {
          return { page: 1, limit: 10, sortKey: 'Candidate.firstName|Candidate.lastName', sortOrder: 'asc' };
        }
        syncFilterFormValues() {
          this.filterForm.forEach((e) => {
            e.value = void 0 === this.filterFormData[e.key] ? '' : this.filterFormData[e.key];
          });
        }
        syncSearchFieldValue() {
          const e = this.searchQuery.q || '';
          ((this.searchForm[0].value = e),
            this.searchFormId?.form.setValue({ [this.searchForm[0].key]: e }, { emitEvent: !1 }));
        }
        persistSearchState() {
          try {
            localStorage.setItem(
              this.publicSearchStorageKey,
              JSON.stringify({
                filterFormData: this.filterFormData,
                filterLabel: this.filterLabel,
                searchQuery: this.searchQuery,
              }),
            );
          } catch (e) {
            console.error('Failed to persist public search state', e);
          }
        }
        restoreSearchState() {
          try {
            const e = localStorage.getItem(this.publicSearchStorageKey);
            if (!e) return;
            const t = JSON.parse(e);
            t?.filterFormData && (this.filterFormData = { ...this.initFilterForm(), ...t.filterFormData });
            t?.filterLabel && (this.filterLabel = t.filterLabel);
            t?.searchQuery && (this.searchQuery = { ...this.getDefaultSearchQuery(), ...t.searchQuery });
            (this.syncFilterFormValues(), this.syncSearchFieldValue());
          } catch (e) {
            console.error('Failed to restore public search state', e);
          }
        }
        ngOnInit() {
          var e = this;
          return (0, l.Z)(function* () {
            ((e.childNavigationService.backButtonPressed = !1),
              (e.publicSearchService.isPublicSearch = !0),
              (e.meType = 'public'),
              (e.formLoaded = !0),
              e.restoreSearchState(),
              e.route.queryParamMap.subscribe(
                (function () {
                  var t = (0, l.Z)(function* (i) {
                    const s = i.get('sortBy'),
                      o = i.get('sortOrder'),
                      c = Number(i.get('page'));
                    (e.buildQuery(s, o, c),
                      c && e.setPage(c),
                      e.syncFilterFormValues(),
                      e.syncSearchFieldValue(),
                      e.hasActiveFilters() || e.searchQuery.q ? e.search() : e.fillTable(s, o));
                  });
                  return function (i) {
                    return t.apply(this, arguments);
                  };
                })(),
              ),
              (e.tableActions.downloadAction = e.exportAffidavits),
              e.canCreate());
          })();
        }
        ngAfterViewInit() {
          ((this.searchForm[0].triggerOnEnter = this.searchOnEnter),
            (this.searchForm[0].triggerOnBlur = this.searchOnBlur),
            this.syncSearchFieldValue());
        }
        AddCandidateColumn() {
          const e = this.authService.user?.CandidatesToUsers?.length;
          ((e && e > 1) || 'admin' === this.authService.user?.type) &&
            ((this.showCandidate = !0), (this.candidateId = ''));
        }
        hasActiveFilters() {
          let e;
          for (e in this.filterFormData) if (this.filterFormData[e]) return !0;
          return !1;
        }
        canCreate() {
          ((this.userCanCreate = this.ability.can('create', 'affidavit')),
            this.userCanCreate && '' === this.candidateId && (this.tableActions.additionAction = this.addAffidavit));
        }
        canUpdate() {
          const e = this.ability.cannot('update', 'affidavit');
          this.userCanUpdate = !e;
        }
        fillCandidates() {
          this.candidatesService
            .getAllCandidates(this.meType, { limit: 0, sortKey: 'firstName', sortOrder: 'asc' })
            .then((e) => {
              this.filterForm[this.filterInputsIndex.CANDIDATE].selectOptions = e.data.map((t) => {
                let i = `${t.firstName} ${t.lastName ? t.lastName : ''} ${t.secondLastName ? t.secondLastName : ''}`;
                return ((i = i.replace('  ', ' ')), { label: `${t.documentId} | ${i}`, value: t.id });
              });
            })
            .catch((e) => console.error(e))
            .finally(() => ((this.isFetchingData = !1), this.syncFilterFormValues()));
        }
        getInputIndex(e) {
          return 3 === this.filterForm.length ? e : e - 1;
        }
        buildQuery(e, t, i) {
          (i && Object.assign(this.searchQuery, i), e && Object.assign(this.searchQuery, { sortKey: e, sortOrder: t }));
        }
        searchOnEnter = (e) => {
          if (!this.enableAutoSearch && 'Enter' === e.key) {
            this.searchOnEnterEmitted = !0;
            const t = e.target.value;
            (this.updateSearchQuery(t), this.updateSearchForm(t));
          }
        };
        searchOnBlur = (e) => {
          !this.autoSearchEmitted &&
            !this.searchOnEnterEmitted &&
            ((this.searchOnBlurEmtted = !0),
            this.updateSearchQuery(e.target.value),
            this.updateSearchForm(e.target.value));
        };
        updateSearchForm = (() => {
          var t,
            e = this;
          return (
            (t = (0, l.Z)(function* (i) {
              (e.searchFormId?.form.setValue({ [e.searchForm[0].key]: i }, { emitEvent: !0 }),
                e.searchFormId?.form.controls[e.searchForm[0].key].markAsDirty(),
                e.searchFormId?.form.controls[e.searchForm[0].key].markAsTouched(),
                yield e.search());
            })),
            function (i) {
              return t.apply(this, arguments);
            }
          );
        })();
        search = (() => {
          var e = this;
          return (0, l.Z)(function* () {
            return (
              (e.isFetchingData = !0),
              e.searchQuery.q || delete e.searchQuery.q,
              (e.isFetchingData = !0),
              new Promise(
                (function () {
	                  var t = (0, l.Z)(function* (i, s) {
	                    try {
	                      const o = yield e.affidavitService.getAllAffidavits(e.meType, e.searchQuery);
	                      (o &&
	                        ((e.affidavitsTable = o.data.map((c) => e.getRow(c))),
	                        (e.tablePagination = { page: o.page, limit: o.limit, count: o.count }),
	                        e.syncSearchFieldValue(),
	                        e.persistSearchState()),
	                        i(!0));
	                    } catch (o) {
	                      s(o);
	                    }
                  });
                  return function (i, s) {
                    return t.apply(this, arguments);
                  };
                })(),
              ).finally(() => {
                ((e.isFetchingData = !1), (e.searchOnBlurEmtted = e.searchOnEnterEmitted = e.autoSearchEmitted = !1));
              })
            );
          });
        })();
        initFilterForm() {
          return {
            eventCategoryId: '',
            periodId: '',
            positionId: '',
            provinceId: '',
            districtId: '',
            townshipId: '',
            circuitId: '',
            partyId: '',
            status: '',
            candidateId: '',
            month: '',
            isProclaimed: '',
          };
        }
        searchFormChanges(e) {
          var t = this;
          return (0, l.Z)(function* () {
            t.searchOnBlurEmtted || t.searchOnEnterEmitted || 'autosearch' !== e.type || !e.query
              ? t.resetSearchQuery()
              : ((t.autoSearchEmitted = !0), t.updateSearchQuery(e.query), t.search());
          })();
        }
        updateSearchQuery(e) {
          ((this.searchQuery = { ...this.searchQuery, q: e }), this.persistSearchState());
        }
        resetSearchQuery() {
          (delete this.searchQuery.q,
            (this.searchQuery = { ...this.getDefaultSearchQuery(), ...this.searchQuery, page: 1, limit: 10 }),
            this.syncSearchFieldValue(),
            this.persistSearchState());
        }
        onFilterModalStatus(e) {
          (!this.showFiltersModal &&
            -1 !== this.filterInputsIndex.CANDIDATE &&
            this.filterForm[this.filterInputsIndex.CANDIDATE].selectOptions &&
            0 === this.filterForm[this.filterInputsIndex.CANDIDATE].selectOptions?.length &&
            this.fillCandidates(),
            !this.showFiltersModal &&
              this.filterForm[1].selectOptions &&
              0 === this.filterForm[1].selectOptions?.length &&
              this.fillDropdowns(),
            (this.showFiltersModal = e.isOpen),
            (this.isFormLoaded = !0));
        }
        restartFilters() {
          ((this.filterFormData = this.initFilterForm()),
            this.filterFormId?.resetForm(),
            this.syncFilterFormValues(),
            this.countFilters(),
            this.filter());
        }
        onDeleteModalStatus(e) {
          this.showDeletionModal = e.isOpen;
        }
        cancelDeletion = () => {
          ((this.affidavitId = null), (this.showDeletionModal = !1));
        };
        confirmDeletion = () => {};
        addAffidavit = () => {
          this.router.navigate(['/admin/affidavits/new']);
        };
        editAffidavit(e, t, i) {
          this.publicSearchService.isPublicSearch
            ? 'pending' !== t &&
              'returned' !== t &&
              ((this.tabService.activeLink = ''),
              (this.tabService.defaultTab = void 0),
              this.router.navigate([`/affidavit/${e}/balance`]))
            : this.router.navigate([`/${this.authService.user?.type}/affidavits/edit/${e}`]);
        }
        deleteAffidavit(e) {
          ((this.affidavitId = e), (this.showDeletionModal = !0));
        }
        fillTable(e, t) {
          var i = this;
          return (0, l.Z)(function* () {
            return (
              (i.isFetchingData = !0),
              new Promise(
                (function () {
                  var s = (0, l.Z)(function* (o, c) {
                    try {
                      i.searchQuery = {
                        page: i.tablePagination.page,
                        limit: i.tablePagination.limit,
                        sortKey: e || 'Candidate.firstName|Candidate.lastName',
                        sortOrder: t || 'asc',
                      };
	                      const n = yield i.affidavitService.getAllAffidavits(i.meType, i.searchQuery);
	                      ((i.affidavitsTable = n.data.map((g) => i.getRow(g))),
	                        (i.tablePagination = { page: n.page, limit: n.limit, count: n.count }),
	                        i.syncSearchFieldValue(),
	                        i.persistSearchState(),
	                        o(!0));
                    } catch (n) {
                      c(n);
                    }
                  });
                  return function (o, c) {
                    return s.apply(this, arguments);
                  };
                })(),
              ).finally(() => {
                i.isFetchingData = !1;
              })
            );
          })();
        }
        getRow(e) {
          const t = e.isProclaimed ? 'Si' : 'No',
            i = {
              id: e.id,
              documentId: e.Candidate.documentId,
              Candidate: this.getFullName(e),
              event: e.Postulation?.Event.EventCategory.name,
              Position: e.Postulation?.Position.name,
              Party: e.Party ? e.Party.name : '-',
              month: e.month ? this.monthNames[e.month - 1] : 'N/A',
              status: this.translateStatus(e.status),
              Province: this.getCompleteLocation(e),
              isProclaimed: t,
              statusId: e.status,
              period: `${e.Postulation?.Event.Period?.startYear} - ${e.Postulation?.Event.Period?.endYear}`,
            };
          return (e.isSummary && (i.month += ' (Final)'), i);
        }
        getEventName(e) {
          let t = e.Postulation?.Event.EventCategory.name;
          return ((t += ` | ${e.Postulation?.Event.Period?.startYear} - ${e.Postulation?.Event.Period?.endYear}`), t);
        }
        handleChangePage(e) {
          (this.setPage(e),
            this.router.navigate([''], { queryParams: { page: e }, queryParamsHandling: 'merge' }),
            this.searchQuery.q && this.search());
        }
        onSortTable(e) {
          this.setPage(1);
          let t = e.column;
          switch (e.column) {
            case 'documentId':
              t = 'Candidate.documentId';
              break;
            case 'Candidate':
              t = 'Candidate.firstName|Candidate.lastName';
              break;
            case 'event':
              t = 'Postulation.Event.EventCategory.name|Postulation.Event.Period.startYear';
              break;
            case 'Province':
              t = 'Postulation.Province.name';
              break;
            case 'Position':
              t = 'Postulation.Position.name';
              break;
            case 'Party':
              t = 'Party.name';
          }
          this.router.navigate([''], {
            queryParams: { sortBy: t, sortOrder: e.dir, page: 1 },
            queryParamsHandling: 'merge',
          });
        }
        setPage(e) {
          ((this.tablePagination.page = e), (this.searchQuery.page = e));
        }
        exportAffidavits = () => {
          this.showExportationModal = !0;
        };
        onExportModalStatus(e) {
          this.showExportationModal = e.isOpen;
        }
        translateStatus(e) {
          return this.statusTranslations[e];
        }
        handleCreateReport = (() => {
          var e = this;
          return (0, l.Z)(function* () {
            ((e.isExporting = !0), (e.searchQuery.limit = 0));
            const i = (yield e.affidavitService.getAllAffidavits(e.meType, e.searchQuery)).data.map(
                (o) => (
                  o.Postulation?.Event.name.split('-'),
                  {
                    event: o.Postulation?.Event.name,
                    Province: e.getCompleteLocation(o),
                    Position: o.Postulation?.Position.name,
                    status: e.translateStatus(o.status),
                  }
                ),
              ),
              s = e.pdfSvc.createReport(i, 'Informes', ['Evento', 'Per\xedodo', 'Postulaci\xf3n', 'Estatus']);
            (N().createPdf(s).download(), (e.isExporting = !1), (e.searchQuery.limit = 10));
          });
        })();
        getFullName(e) {
          let t = e.Candidate?.firstName;
          return (
            e.Candidate?.middleName && (t += ` ${e.Candidate.middleName}`),
            e.Candidate?.lastName && (t += ` ${e.Candidate.lastName}`),
            e.Candidate?.secondLastName && (t += ` ${e.Candidate.secondLastName}`),
            t || ''
          );
        }
        exportData(e) {
          var t = this;
          return (0, l.Z)(function* () {
            ((t.isExporting = !0), (t.searchQuery.limit = 0));
            const s = (yield t.affidavitService.getAllAffidavits(t.meType, t.searchQuery)).data.map((n) => {
                const g = n.isProclaimed ? 'Si' : 'No';
                let P;
                return (
                  (P =
                    'pdf' === e
                      ? {
                          status: t.translateStatus(n.status),
                          Candidate: `${n.Candidate.documentId} | ${t.getFullName(n)}`,
                          event: t.getEventName(n),
                          Position: n.Postulation?.Position.name,
                          Party: n.Party ? n.Party.name : '-',
                          Province: t.getCompleteLocation(n),
                          isProclaimed: g,
                        }
                      : {
                          status: t.translateStatus(n.status),
                          documentId: n.Candidate.documentId,
                          Candidate: t.getFullName(n),
                          event: t.getEventName(n),
                          Position: n.Postulation?.Position.name,
                          Party: n.Party ? n.Party.name : '-',
                          Province: t.getCompleteLocation(n),
                          isProclaimed: g,
                        }),
                  P
                );
              }),
              o = [
                { header: 'Estatus', key: 'status', width: 20 },
                { header: 'C\xe9dula', key: 'documentId', width: 20 },
                { header: 'Candidato', key: 'Candidate', width: 50 },
                { header: 'Evento', key: 'event', width: 50 },
                { header: 'Cargo', key: 'Position', width: 20 },
                { header: 'Partido/Libre postulaci\xf3n', key: 'Party', width: 20 },
                { header: 'Ubicaci\xf3n', key: 'Province', width: 30 },
                { header: 'Proclamado', key: 'isProclaimed', width: 20 },
              ];
            (t.showCandidate && o.splice(1, 0, { header: 'Candidato', key: 'Candidate', width: 40 }),
              'pdf' === e && o.splice(1, 1));
            const c = {
              worksheet: { name: 'Informes' },
              columns: o,
              fileName: 'Informes',
              data: s,
              pageOritation: 'landscape',
            };
            ('excel' === e && t.exportService.exportToExcel(c),
              'csv' === e && t.exportService.exportToCsv(c),
              'pdf' === e && t.exportService.exportToPdf(c),
              (t.isExporting = !1),
              (t.searchQuery.limit = 10));
          })();
        }
        exportToExcel = (() => {
          var e = this;
          return (0, l.Z)(function* () {
            yield e.exportData('excel');
          });
        })();
        exportToCsv = (() => {
          var e = this;
          return (0, l.Z)(function* () {
            yield e.exportData('csv');
          });
        })();
        exportToPdf = (() => {
          var e = this;
          return (0, l.Z)(function* () {
            yield e.exportData('pdf');
          });
        })();
        filterFormChange(e) {
          var t = this;
          return (0, l.Z)(function* () {
            e instanceof Event ||
              (yield t.ubicationBehaviorService.selectChanges({
                event: e,
                formData: t.filterFormData,
                inputsIndex: t.filterInputsIndex,
                formId: t.filterFormId,
                form: t.filterForm,
                meType: 'public',
	              }),
	              e.isProclaimed && (e.isProclaimed = 'true' === e.isProclaimed),
	              Object.assign(t.filterFormData, { ...e }),
	              t.syncFilterFormValues(),
	              t.countFilters(),
	              t.filter());
          })();
        }
        formatFilter() {
          const e = this.removeAttribute(this.filterFormData),
            t = {
              Postulation: {
                eventId: '',
                positionId: '',
                provinceId: '',
                districtId: '',
                townshipId: '',
                circuitId: '',
                Event: { periodId: '', eventCategoryId: '' },
              },
              partyId: '',
              status: '',
              candidateId: '',
              isProclaimed: !1,
              month: '',
            };
          let i, s;
          for (i in (void 0 === this.filterFormData.isProclaimed && delete t.isProclaimed, e))
            'status' === i || 'candidateId' === i || 'isProclaimed' === i || 'month' === i || 'partyId' === i
              ? (t[i] = e[i])
              : 'periodId' === i || 'eventCategoryId' === i
                ? (t.Postulation.Event[i] = e[i])
                : (t.Postulation[i] = e[i]);
          for (s in t)
            if ('' === t[s]) delete t[s];
            else if ('Postulation' === s) {
              let o;
              for (o in t.Postulation)
                'Event' === o
                  ? ('' === t.Postulation[o].periodId && delete t.Postulation[o].periodId,
                    '' === t.Postulation[o].eventCategoryId && delete t.Postulation[o].eventCategoryId)
                  : '' === t.Postulation[o] && delete t.Postulation[o];
            }
          return t;
        }
        countFilters() {
          const e = this.filterFormId?.form.value,
            t = Object.entries(e || {})?.filter((i) => !!i[1] || !1 === i[1]);
          this.filterLabel = t.length ? `(${t.length}) ${t.length > 1 ? 'Filtros' : 'Filtro'}` : 'Filtros';
        }
        removeAttribute(e) {
          for (const t in e) ('' === e[t] || null == e[t]) && delete e[t];
          return e;
        }
        filter = () => {
          const e = this.formatFilter();
          ((this.searchQuery = {
            page: 1,
            limit: 10,
            sortKey: this.searchQuery.sortKey ? this.searchQuery.sortKey : 'Candidate.firstName|Candidate.lastName',
            sortOrder: this.searchQuery.sortOrder ? this.searchQuery.sortOrder : 'asc',
            q: this.searchQuery.q ? this.searchQuery.q : '',
          }),
            e.candidateId && (this.searchQuery.candidateId = e.candidateId),
            e.status && (this.searchQuery.status = e.status),
            e.Postulation && (this.searchQuery.Postulation = e.Postulation),
	            e.partyId && (this.searchQuery.partyId = e.partyId),
	            this.candidateId && '' !== this.candidateId && (this.searchQuery.candidateId = this.candidateId),
	            void 0 !== e.isProclaimed && (this.searchQuery.isProclaimed = e.isProclaimed),
	            e.month && (this.searchQuery.month = e.month),
	            this.persistSearchState(),
	            this.search());
        };
        cancel = () => {
	          ((this.showFiltersModal = !1), (this.isFormLoaded = !1), this.syncFilterFormValues(), this.persistSearchState());
        };
        getCompleteLocation(e) {
          let c =
            (e.Postulation && e.Postulation.Province ? e.Postulation.Province.name + ' | ' : '') +
            (e.Postulation && e.Postulation.District ? e.Postulation.District.name + ' | ' : '') +
            (e.Postulation && e.Postulation.Township ? e.Postulation.Township.name + ' | ' : '') +
            (e.Postulation && e.Postulation.Circuit ? e.Postulation.Circuit.name : '');
          const n = c.split(' | ');
          return ('' === n[n.length - 1] && (c = n.slice(0, n.length - 1).join(' | ')), '' !== c ? c : '-');
        }
        fillProvince() {
          var e = this;
          return (0, l.Z)(function* () {
            const t = yield e.provinceService.getAllProvinces(e.meType, {
              limit: 0,
              sortKey: 'name',
              sortOrder: 'asc',
            });
            e.filterForm[e.filterInputsIndex.PROVINCE].selectOptions = t.data.map((i) => ({
              label: i.name,
              value: i.id,
            }));
          })();
        }
        fillEvents() {
          var e = this;
          return (0, l.Z)(function* () {
            const t = yield e.eventsCategoriesService.getAllCategories(e.meType, {
              limit: 0,
              sortKey: 'name',
              sortOrder: 'asc',
            });
            e.filterForm[e.filterInputsIndex.EVENT].selectOptions = t.data.map((i) => ({ label: i.name, value: i.id }));
          })();
        }
        fillPositions() {
          var e = this;
          return (0, l.Z)(function* () {
            const t = yield e.positionsService.getAllPositions(e.meType, {
              limit: 0,
              sortKey: 'name',
              sortOrder: 'asc',
            });
            e.filterForm[e.filterInputsIndex.POSITION].selectOptions = t.data.map((i) => ({
              label: i.name,
              value: i.id,
            }));
          })();
        }
        fillParties() {
          var e = this;
          return (0, l.Z)(function* () {
            const t = yield e.partiesService.getAllParties(e.meType, { limit: 0, sortKey: 'name', sortOrder: 'asc' });
            e.filterForm[e.filterInputsIndex.PARTY].selectOptions = t.data.map((i) => ({ label: i.name, value: i.id }));
          })();
        }
        fillDistrict() {
          var e = this;
          return (0, l.Z)(function* () {
            const t = yield e.districtService.getAllDistricts(e.meType, {
              limit: 0,
              sortKey: 'name',
              sortOrder: 'asc',
            });
            e.filterForm[e.filterInputsIndex.DISTRICT].selectOptions = t.data.map((i) => ({
              label: i.name,
              value: i.id,
            }));
          })();
        }
        fillTownship() {
          var e = this;
          return (0, l.Z)(function* () {
            const t = yield e.townshipService.getAllTownship(e.meType, { limit: 0, sortKey: 'name', sortOrder: 'asc' });
            e.filterForm[e.filterInputsIndex.TOWNSHIP].selectOptions = t.data.map((i) => ({
              label: i.name,
              value: i.id,
            }));
          })();
        }
        fillCircuit() {
          var e = this;
          return (0, l.Z)(function* () {
            const t = yield e.circuitsService.getAllCircuits(e.meType, { limit: 0, sortKey: 'name', sortOrder: 'asc' });
            e.filterForm[e.filterInputsIndex.CIRCUIT].selectOptions = t.data.map((i) => ({
              label: i.name,
              value: i.id,
            }));
          })();
        }
        fillPeriod() {
          var e = this;
          return (0, l.Z)(function* () {
            const t = yield e.periodService.getAllPeriods(e.meType, {
              limit: 0,
              sortKey: 'startYear',
              sortOrder: 'asc',
            });
            e.filterForm[e.filterInputsIndex.PERIOD].selectOptions = t.data.map((i) => ({
              label: `${i.startYear} - ${i.endYear}`,
              value: i.id,
            }));
          })();
        }
        fillDropdowns() {
          var e = this;
          return (0, l.Z)(function* () {
            (yield e.fillPositions(),
              yield e.fillParties(),
              yield e.fillProvince(),
              yield e.fillEvents(),
              yield e.fillDistrict(),
              yield e.fillTownship(),
              yield e.fillCircuit(),
              yield e.fillPeriod(),
              e.syncFilterFormValues());
          })();
        }
        static ɵfac = function (t) {
          return new (t || S)(
            a.Y36(m.F0),
            a.Y36(m.gz),
            a.Y36(M.$U),
            a.Y36(Q.c),
            a.Y36(Z.$),
            a.Y36(L.e8),
            a.Y36(U.o),
            a.Y36(Y.F),
            a.Y36(R.T),
            a.Y36(B.f),
            a.Y36($.R),
            a.Y36(K.t),
            a.Y36(W.a),
            a.Y36(J.n),
            a.Y36(k.m),
            a.Y36(z.p),
            a.Y36(G.Z),
            a.Y36(V.p),
            a.Y36(H.L),
            a.Y36(j.q),
            a.Y36(X.M),
            a.Y36(q.v),
          );
        };
        static ɵcmp = a.Xpm({
          type: S,
          selectors: [['app-public-search']],
          viewQuery: function (t, i) {
            if ((1 & t && (a.Gf(_, 5), a.Gf(ee, 5)), 2 & t)) {
              let s;
              (a.iGM((s = a.CRH())) && (i.searchFormId = s.first), a.iGM((s = a.CRH())) && (i.filterFormId = s.first));
            }
          },
          inputs: { candidateId: 'candidateId' },
          decls: 34,
          vars: 32,
          consts: [
            [1, 'main--full'],
            [1, 'public-wrapper'],
            [1, 'logo'],
            ['src', '../../../assets/logo.svg', 'alt', 'logo', 1, 'sirig-logo'],
            ['src', '../../../assets/LOGO-TE-2022-rgb.png', 'alt', 'logo', 1, 'te-logo'],
            [1, 'content-box', 'mobile-frame-less'],
            [1, 'table-external-wrapper'],
            [
              3,
              'rows',
              'columns',
              'icons',
              'actions',
              'pagination',
              'resultsLabel',
              'isLoading',
              'showLoading',
              'columnMode',
              'isExporting',
              'tableActionsLabels',
              'hasSearch',
              'searchForm',
              'filterActionLabel',
              'hintProp',
              'maxLengthToShowHint',
              'enableAutoSearch',
              'changeCurrentPage',
              'onSorting',
              'onSearchChange',
            ],
            [1, 'filters-wrapper', 'filters-wrapper--block', 3, 'ngClass'],
            [1, 'filters-box'],
            [1, 'filters__actions-box'],
            [1, 'remove-filters', 'text-primary'],
            [3, 'click'],
            [1, 'text-right', 'close-btn', 'text-primary'],
            [1, 'filters-body'],
            [3, 'fields', 'updateOn', 'change'],
            ['filterFormTemplate', ''],
            ['size', 'md', 3, 'displayButton', 'isActive', 'hasCloseButton', 'onAction'],
            [1, 'modal-wrapper'],
            [1, 'text-primary', 2, 'text-align', 'center'],
            [1, 'paragraph-1'],
            [1, 'modal-buttons-wrapper', 'modal-buttons-wrapper--absolute'],
            ['type', 'solid', 3, 'isInverted', 'callback'],
            ['color', 'primary', 'type', 'solid', 3, 'isInverted', 'callback'],
          ],
          template: function (t, i) {
            (1 & t &&
              (a.TgZ(0, 'main', 0)(1, 'div', 1)(2, 'div', 2)(3, 'div'),
              a._UZ(4, 'img', 3)(5, 'img', 4),
              a.qZA()(),
              a.TgZ(6, 'div', 5)(7, 'div', 6)(8, 'prt-table', 7),
              a.NdJ('changeCurrentPage', function (o) {
                return i.handleChangePage(o);
              })('onSorting', function (o) {
                return i.onSortTable(o);
              })('onSearchChange', function (o) {
                return i.searchFormChanges(o);
              }),
              a.qZA()(),
              a.TgZ(9, 'div', 8)(10, 'div', 9)(11, 'div', 10)(12, 'div', 11)(13, 'a', 12),
              a.NdJ('click', function () {
                return i.restartFilters();
              }),
              a._uU(14),
              a.qZA()(),
              a.TgZ(15, 'div', 13)(16, 'a', 12),
              a.NdJ('click', function () {
                return i.onFilterModalStatus({ isOpen: !1 });
              }),
              a._uU(17, 'Cerrar'),
              a.qZA()()(),
              a.TgZ(18, 'div', 14)(19, 'prt-form', 15, 16),
              a.NdJ('change', function (o) {
                return i.filterFormChange(o);
              }),
              a.qZA()()()(),
              a.TgZ(21, 'prt-modal', 17),
              a.NdJ('onAction', function (o) {
                return i.onExportModalStatus(o);
              }),
              a.TgZ(22, 'div', 18)(23, 'h2', 19),
              a._uU(24, ' Formato '),
              a.qZA(),
              a.TgZ(25, 'span', 20),
              a._uU(26, '\xbfEn que formato desea exportar los datos?'),
              a.qZA(),
              a.TgZ(27, 'div', 21)(28, 'prt-button', 22),
              a._uU(29, ' PDF '),
              a.qZA(),
              a.TgZ(30, 'prt-button', 22),
              a._uU(31, ' CSV '),
              a.qZA(),
              a.TgZ(32, 'prt-button', 23),
              a._uU(33, ' Excel '),
              a.qZA()()()()()()()),
              2 & t &&
                (a.xp6(8),
                a.Q6J('rows', i.affidavitsTable)('columns', i.tableColumns)('icons', i.tableIcons)(
                  'actions',
                  i.tableActions,
                )('pagination', i.tablePagination)('resultsLabel', 'Documentos')('isLoading', !i.isFetchingData)(
                  'showLoading',
                  !0,
                )('columnMode', 'force')('isExporting', i.isExporting)('tableActionsLabels', !0)('hasSearch', !0)(
                  'searchForm',
                  i.searchForm,
                )('filterActionLabel', i.filterLabel)('hintProp', 'Province')('maxLengthToShowHint', 15)(
                  'enableAutoSearch',
                  i.enableAutoSearch,
                ),
                a.xp6(1),
                a.Q6J('ngClass', a.VKq(30, te, i.showFiltersModal)),
                a.xp6(5),
                a.hij('Limpiar ', i.filterLabel, ''),
                a.xp6(5),
                a.Q6J('fields', i.filterForm)('updateOn', 'change'),
                a.xp6(2),
                a.Q6J('displayButton', !0)('isActive', i.showExportationModal)('hasCloseButton', !0),
                a.xp6(7),
                a.Q6J('isInverted', !0)('callback', i.exportToPdf),
                a.xp6(2),
                a.Q6J('isInverted', !0)('callback', i.exportToCsv),
                a.xp6(2),
                a.Q6J('isInverted', !0)('callback', i.exportToExcel)));
          },
          dependencies: [v.mk, d.zS, d.r0, d.Ur, d.ac],
          styles: [
            '[_nghost-%COMP%]{width:100%}  .ng-dropdown-panel .ng-dropdown-panel-items{max-height:102px!important}  .ng-dropdown-panel .ng-dropdown-panel-items .ng-option{height:34px}.logo[_ngcontent-%COMP%]{display:block;text-align:center;place-items:center}@media (min-width: 0){.logo[_ngcontent-%COMP%]{margin-bottom:0;margin-top:0;padding:0}}.sirig-logo[_ngcontent-%COMP%]{width:330px;margin-right:60px}@media (min-width: 0){.sirig-logo[_ngcontent-%COMP%]{width:55%;margin-right:0}}@media (min-width: 768px){.sirig-logo[_ngcontent-%COMP%]{width:330px;margin-right:60px}}.te-logo[_ngcontent-%COMP%]{height:100px;margin-top:10px;margin-bottom:10px}@media (min-width: 0){.te-logo[_ngcontent-%COMP%]{width:50%;height:40%}}@media (min-width: 768px){.te-logo[_ngcontent-%COMP%]{height:100px;width:initial;margin-top:10px;margin-bottom:10px}}',
          ],
        });
      }
      const ie = [
        { path: '', component: S },
        { path: 'new', component: A.T },
        {
          path: 'affidavit/:id',
          component: w.q,
          canActivateChild: [T.b],
          children: [
            { path: 'affidavit-document', component: O.M },
            { path: 'balance', component: u.R },
            { path: 'totals', component: y.y },
            { path: 'incomes', component: p.s },
            { path: 'expenses', component: h.o },
            { path: 'donors', component: E.G },
            { path: 'transactions', component: F.F },
            { path: 'audit-report', component: x.m },
          ],
        },
      ];
      class I {
        static ɵfac = function (t) {
          return new (t || I)();
        };
        static ɵmod = a.oAB({ type: I });
        static ɵinj = a.cJS({ imports: [m.Bz.forChild(ie), m.Bz] });
      }
      var ae = r(8395);
      class b {
        static ɵfac = function (t) {
          return new (t || b)();
        };
        static ɵmod = a.oAB({ type: b });
        static ɵinj = a.cJS({ imports: [v.ez, I, ae.m] });
      }
    },
    5730: (C, f, r) => {
      r.d(f, { M: () => u });
      var v = r(9168),
        m = r(4650),
        y = r(5146);
      class u {
        apiService;
        constructor(h) {
          this.apiService = h;
        }
        getAllCategories(h, p) {
          return this.apiService.get(`/${h}${v.Z.EVENT_CATEGORY}`, p);
        }
        static ɵfac = function (p) {
          return new (p || u)(m.LFG(y.s));
        };
        static ɵprov = m.Yz7({ token: u, factory: u.ɵfac, providedIn: 'root' });
      }
    },
    4064: (C, f, r) => {
      r.d(f, { v: () => u });
      var v = r(9168),
        m = r(4650),
        y = r(5146);
      class u {
        apiService;
        constructor(h) {
          this.apiService = h;
        }
        getAllPeriods(h, p) {
          return this.apiService.get(`/${h}${v.Z.PERIODS}`, p);
        }
        deletePeriod(h) {
          return this.apiService.delete(`${v.Z.PERIODS}/${h}`);
        }
        static ɵfac = function (p) {
          return new (p || u)(m.LFG(y.s));
        };
        static ɵprov = m.Yz7({ token: u, factory: u.ɵfac, providedIn: 'root' });
      }
    },
  },
]);
